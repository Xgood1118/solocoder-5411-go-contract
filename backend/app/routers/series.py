from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import db
from ..models import User, SeriesInfo
from ..auth import get_current_user

router = APIRouter(prefix="/series", tags=["序列"])


@router.get("/{series_uid}", response_model=SeriesInfo)
async def get_series(
    series_uid: str,
    current_user: User = Depends(get_current_user),
):
    series = db.series.get(series_uid)
    if not series:
        raise HTTPException(status_code=404, detail="序列不存在")
    return series


@router.get("/study/{study_uid}", response_model=List[SeriesInfo])
async def get_study_series(
    study_uid: str,
    current_user: User = Depends(get_current_user),
):
    study = db.studies.get(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail="检查不存在")

    series_list = [db.series[uid] for uid in study.series_uids if uid in db.series]
    series_list.sort(key=lambda s: s.series_number)
    return series_list
