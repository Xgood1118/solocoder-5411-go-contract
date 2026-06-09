import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body

from ..database import db
from ..models import User, Report
from ..auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/reports", tags=["报告"])


@router.get("/study/{study_uid}", response_model=List[Report])
async def get_study_reports(
    study_uid: str,
    current_user: User = Depends(get_current_user),
):
    study = db.studies.get(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail="检查不存在")

    reports = [r for r in db.reports.values() if r.study_uid == study_uid]
    reports.sort(key=lambda r: r.updated_at, reverse=True)
    return reports


@router.get("/{report_id}", response_model=Report)
async def get_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
):
    report = db.reports.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@router.post("", response_model=Report)
async def create_report(
    report_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    study_uid = report_data.get("study_uid")
    if not study_uid:
        raise HTTPException(status_code=400, detail="缺少 study_uid")

    study = db.studies.get(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail="检查不存在")

    report_id = str(uuid.uuid4())
    now = datetime.utcnow()

    report = Report(
        report_id=report_id,
        study_uid=study_uid,
        series_uid=report_data.get("series_uid"),
        content=report_data.get("content", ""),
        created_by=current_user.user_id,
        created_by_name=current_user.full_name,
        created_at=now,
        updated_at=now,
    )

    db.reports[report_id] = report
    return report


@router.put("/{report_id}", response_model=Report)
async def update_report(
    report_id: str,
    report_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    report = db.reports.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    if report.created_by != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="只能修改自己的报告")

    if "content" in report_data:
        report.content = report_data["content"]

    report.updated_at = datetime.utcnow()
    return report


@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
):
    report = db.reports.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    if report.created_by != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="只能删除自己的报告")

    del db.reports[report_id]
    return {"success": True}
