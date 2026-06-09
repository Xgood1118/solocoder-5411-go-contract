from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import db
from ..models import User, StudyInfo, PatientInfo
from ..auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/studies", tags=["检查"])


@router.get("")
async def list_studies(
    patient_id: Optional[str] = None,
    modality: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    studies = list(db.studies.values())

    if patient_id:
        studies = [s for s in studies if s.patient_id == patient_id]

    if modality:
        studies = [s for s in studies if modality in s.modalities_in_study]

    studies.sort(
        key=lambda s: f"{s.study_date} {s.study_time}",
        reverse=True
    )

    result = []
    for study in studies[skip : skip + limit]:
        study_dict = study.model_dump()
        patient = db.patients.get(study.patient_id)
        if patient:
            study_dict["patient_name"] = patient.patient_name
            study_dict["patient_sex"] = patient.patient_sex
            study_dict["patient_age"] = patient.patient_age
        result.append(study_dict)

    return result


@router.get("/{study_uid}")
async def get_study(
    study_uid: str,
    current_user: User = Depends(get_current_user),
):
    study = db.studies.get(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail="检查不存在")

    study_dict = study.model_dump()
    patient = db.patients.get(study.patient_id)
    if patient:
        study_dict["patient_name"] = patient.patient_name
        study_dict["patient_sex"] = patient.patient_sex
        study_dict["patient_age"] = patient.patient_age

    return study_dict


@router.get("/{study_uid}/patient", response_model=PatientInfo)
async def get_study_patient(
    study_uid: str,
    current_user: User = Depends(get_current_user),
):
    study = db.studies.get(study_uid)
    if not study:
        raise HTTPException(status_code=404, detail="检查不存在")

    patient = db.patients.get(study.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者不存在")
    return patient


@router.get("/patient/{patient_id}", response_model=List[StudyInfo])
async def get_patient_studies(
    patient_id: str,
    current_user: User = Depends(get_current_user),
):
    study_uids = db.studies_by_patient.get(patient_id, [])
    studies = [db.studies[uid] for uid in study_uids if uid in db.studies]
    studies.sort(
        key=lambda s: f"{s.study_date} {s.study_time}",
        reverse=True
    )
    return studies
