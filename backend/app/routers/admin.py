from typing import List, Dict
from fastapi import APIRouter, Depends, Query

from ..database import db
from ..models import User, UserRole, AnnotationStatus
from ..auth import get_current_user, require_role

router = APIRouter(prefix="/admin", tags=["管理"])


@router.get("/stats/annotation-volume")
async def get_annotation_volume_stats(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.REVIEWER)),
):
    stats = []
    for user in db.users.values():
        annotation_ids = db.annotations_by_user.get(user.user_id, [])
        total = len(annotation_ids)
        rejected = len(
            [aid for aid in annotation_ids
             if aid in db.annotations and db.annotations[aid].status == AnnotationStatus.REJECTED]
        )
        accepted = len(
            [aid for aid in annotation_ids
             if aid in db.annotations and db.annotations[aid].status == AnnotationStatus.ACTIVE]
        )
        pending = len(
            [aid for aid in annotation_ids
             if aid in db.annotations and db.annotations[aid].status == AnnotationStatus.PENDING]
        )

        rejection_rate = (rejected / total * 100) if total > 0 else 0
        accuracy_rate = (accepted / total * 100) if total > 0 else 0

        stats.append({
            "user_id": user.user_id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "total_annotations": total,
            "accepted_annotations": accepted,
            "rejected_annotations": rejected,
            "pending_annotations": pending,
            "rejection_rate": round(rejection_rate, 2),
            "accuracy_rate": round(accuracy_rate, 2),
        })

    stats.sort(key=lambda x: x["total_annotations"], reverse=True)
    return stats


@router.get("/stats/overview")
async def get_overall_stats(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.REVIEWER)),
):
    total_studies = len(db.studies)
    total_series = len(db.series)
    total_images = len(db.images)
    total_annotations = len(db.annotations)
    total_users = len(db.users)
    total_patients = len(db.patients)

    active_annotations = len(
        [a for a in db.annotations.values() if a.status == AnnotationStatus.ACTIVE]
    )
    pending_annotations = len(
        [a for a in db.annotations.values() if a.status == AnnotationStatus.PENDING]
    )
    rejected_annotations = len(
        [a for a in db.annotations.values() if a.status == AnnotationStatus.REJECTED]
    )

    locked_images = len(db.image_locks)

    return {
        "total_studies": total_studies,
        "total_series": total_series,
        "total_images": total_images,
        "total_patients": total_patients,
        "total_users": total_users,
        "total_annotations": total_annotations,
        "active_annotations": active_annotations,
        "pending_annotations": pending_annotations,
        "rejected_annotations": rejected_annotations,
        "locked_images": locked_images,
    }


@router.get("/users", response_model=List[User])
async def list_users(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    users = list(db.users.values())
    return users
