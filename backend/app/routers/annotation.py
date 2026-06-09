import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body

from ..database import db
from ..models import (
    User, Annotation, AnnotationStatus, AnnotationType,
    AnnotationCategory, AnnotationPoint
)
from ..auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/annotations", tags=["标注"])


@router.get("/image/{image_uid}", response_model=List[Annotation])
async def get_image_annotations(
    image_uid: str,
    include_rejected: bool = Query(False, description="是否包含被拒绝的标注"),
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    annotation_ids = db.annotations_by_image.get(image_uid, [])
    annotations = [db.annotations[aid] for aid in annotation_ids if aid in db.annotations]

    if not include_rejected:
        annotations = [a for a in annotations if a.status != AnnotationStatus.REJECTED]

    annotations.sort(key=lambda a: a.created_at, reverse=True)
    return annotations


@router.get("/series/{series_uid}", response_model=List[Annotation])
async def get_series_annotations(
    series_uid: str,
    include_rejected: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    series = db.series.get(series_uid)
    if not series:
        raise HTTPException(status_code=404, detail="序列不存在")

    all_annotations = []
    for image_uid in series.image_uids:
        annotation_ids = db.annotations_by_image.get(image_uid, [])
        for aid in annotation_ids:
            if aid in db.annotations:
                ann = db.annotations[aid]
                if include_rejected or ann.status != AnnotationStatus.REJECTED:
                    all_annotations.append(ann)

    all_annotations.sort(key=lambda a: a.created_at, reverse=True)
    return all_annotations


@router.get("/study/{study_uid}", response_model=List[Annotation])
async def get_study_annotations(
    study_uid: str,
    include_rejected: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    study = db.studies.get(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail="检查不存在")

    all_annotations = []
    for series_uid in study.series_uids:
        series = db.series.get(series_uid)
        if not series:
            continue
        for image_uid in series.image_uids:
            annotation_ids = db.annotations_by_image.get(image_uid, [])
            for aid in annotation_ids:
                if aid in db.annotations:
                    ann = db.annotations[aid]
                    if include_rejected or ann.status != AnnotationStatus.REJECTED:
                        all_annotations.append(ann)

    all_annotations.sort(key=lambda a: a.created_at, reverse=True)
    return all_annotations


@router.get("/me", response_model=List[Annotation])
async def get_my_annotations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[AnnotationStatus] = None,
    current_user: User = Depends(get_current_user),
):
    annotation_ids = db.annotations_by_user.get(current_user.user_id, [])
    annotations = [db.annotations[aid] for aid in annotation_ids if aid in db.annotations]

    if status:
        annotations = [a for a in annotations if a.status == status]

    annotations.sort(key=lambda a: a.created_at, reverse=True)
    return annotations[skip : skip + limit]


@router.get("/{annotation_id}", response_model=Annotation)
async def get_annotation(
    annotation_id: str,
    current_user: User = Depends(get_current_user),
):
    annotation = db.annotations.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    return annotation


@router.post("", response_model=Annotation)
async def create_annotation(
    annotation_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    image_uid = annotation_data.get("image_uid")
    if not image_uid:
        raise HTTPException(status_code=400, detail="缺少 image_uid")

    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    lock = db.image_locks.get(image_uid)
    if lock and lock.locked_by != current_user.user_id:
        raise HTTPException(
            status_code=409,
            detail=f"{lock.locked_by_name}正在标注该影像，请稍后再试"
        )

    annotation_id = str(uuid.uuid4())
    points_data = annotation_data.get("points", [])
    points = [AnnotationPoint(x=p["x"], y=p["y"]) for p in points_data]

    annotation = Annotation(
        annotation_id=annotation_id,
        image_uid=image_uid,
        series_uid=image.series_uid,
        study_uid=image.study_uid,
        annotation_type=AnnotationType(annotation_data.get("annotation_type", "rectangle")),
        category=AnnotationCategory(annotation_data["category"]) if annotation_data.get("category") else None,
        label=annotation_data.get("label"),
        points=points,
        text_content=annotation_data.get("text_content"),
        created_by=current_user.user_id,
        created_by_name=current_user.full_name,
        created_at=datetime.utcnow(),
        status=AnnotationStatus.PENDING,
    )

    db.annotations[annotation_id] = annotation
    db.annotations_by_image[image_uid].append(annotation_id)
    db.annotations_by_user[current_user.user_id].append(annotation_id)

    return annotation


@router.put("/{annotation_id}", response_model=Annotation)
async def update_annotation(
    annotation_id: str,
    annotation_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    annotation = db.annotations.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")

    if annotation.created_by != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="只能修改自己的标注")

    if annotation_data.get("category"):
        annotation.category = AnnotationCategory(annotation_data["category"])

    if annotation_data.get("label") is not None:
        annotation.label = annotation_data["label"]

    if annotation_data.get("text_content") is not None:
        annotation.text_content = annotation_data["text_content"]

    if annotation_data.get("points"):
        points_data = annotation_data["points"]
        annotation.points = [AnnotationPoint(x=p["x"], y=p["y"]) for p in points_data]

    return annotation


@router.delete("/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    current_user: User = Depends(get_current_user),
):
    annotation = db.annotations.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")

    if annotation.created_by != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="只能删除自己的标注")

    del db.annotations[annotation_id]

    if annotation_id in db.annotations_by_image.get(annotation.image_uid, []):
        db.annotations_by_image[annotation.image_uid].remove(annotation_id)

    if annotation_id in db.annotations_by_user.get(annotation.created_by, []):
        db.annotations_by_user[annotation.created_by].remove(annotation_id)

    return {"success": True}


@router.post("/{annotation_id}/accept", response_model=Annotation)
async def accept_annotation(
    annotation_id: str,
    current_user: User = Depends(require_role(UserRole.REVIEWER, UserRole.ADMIN)),
):
    annotation = db.annotations.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")

    annotation.status = AnnotationStatus.ACTIVE
    annotation.reviewed_by = current_user.user_id
    annotation.reviewed_at = datetime.utcnow()

    return annotation


@router.post("/{annotation_id}/reject", response_model=Annotation)
async def reject_annotation(
    annotation_id: str,
    body: dict = Body(default={}),
    current_user: User = Depends(require_role(UserRole.REVIEWER, UserRole.ADMIN)),
):
    annotation = db.annotations.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")

    annotation.status = AnnotationStatus.REJECTED
    annotation.reviewed_by = current_user.user_id
    annotation.reviewed_at = datetime.utcnow()
    annotation.review_comment = body.get("comment")

    return annotation


@router.get("/history/image/{image_uid}", response_model=List[Annotation])
async def get_annotation_history(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    annotation_ids = db.annotations_by_image.get(image_uid, [])
    annotations = [db.annotations[aid] for aid in annotation_ids if aid in db.annotations]
    annotations.sort(key=lambda a: a.created_at, reverse=True)
    return annotations
