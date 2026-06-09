import os
import shutil
import uuid
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from datetime import datetime

from pydicom.uid import generate_uid

from .config import settings
from .database import db
from .models import SyncResult, StudyInfo, SeriesInfo, ImageInfo, PatientInfo
from .dicom_utils import extract_dicom_info, generate_mock_dicom


MODALITIES = ["CT", "MRI", "CR", "DX", "US"]


def sync_from_pacs() -> SyncResult:
    result = SyncResult()
    patient_modalities: Dict[str, Set[str]] = defaultdict(set)
    study_patients: Dict[str, str] = {}
    study_modalities: Dict[str, Set[str]] = defaultdict(set)
    all_studies: Dict[str, StudyInfo] = {}
    all_series: Dict[str, SeriesInfo] = {}
    all_images: Dict[str, ImageInfo] = {}
    all_patients: Dict[str, PatientInfo] = {}
    study_errors: Dict[str, List[str]] = defaultdict(list)

    os.makedirs(settings.dicom_storage_dir, exist_ok=True)

    for modality in MODALITIES:
        modality_dir = os.path.join(settings.pacs_dir, modality)
        if not os.path.isdir(modality_dir):
            continue

        for filename in os.listdir(modality_dir):
            if not filename.lower().endswith(".dcm"):
                continue

            file_path = os.path.join(modality_dir, filename)
            try:
                patient, study, series, image = extract_dicom_info(file_path)
            except Exception as e:
                result.errors.append(f"Failed to read DICOM file {filename}: {str(e)}")
                continue

            if patient.patient_id not in all_patients:
                all_patients[patient.patient_id] = patient

            patient_modalities[patient.patient_id].add(modality)

            if study.study_uid not in all_studies:
                all_studies[study.study_uid] = study
                study_patients[study.study_uid] = patient.patient_id
            else:
                if modality not in all_studies[study.study_uid].modalities_in_study:
                    all_studies[study.study_uid].modalities_in_study.append(modality)

            study_modalities[study.study_uid].add(modality)

            if series.series_uid not in all_series:
                all_series[series.series_uid] = series

            if image.image_uid not in all_images:
                all_images[image.image_uid] = image

            stored_path = os.path.join(
                settings.dicom_storage_dir,
                study.study_uid,
                series.series_uid,
                f"{image.instance_number:06d}.dcm"
            )
            os.makedirs(os.path.dirname(stored_path), exist_ok=True)
            shutil.copy2(file_path, stored_path)
            all_images[image.image_uid].file_path = stored_path

    for study_uid, study in all_studies.items():
        patient_id = study_patients[study_uid]
        expected_modalities = patient_modalities[patient_id]
        actual_modalities = study_modalities[study_uid]
        missing = expected_modalities - actual_modalities

        if missing:
            study.sync_status = "partial"
            study.sync_errors = [f"缺少模态: {', '.join(missing)}" for m in missing]
            study_errors[study_uid] = study.sync_errors
            result.failed_studies += 1
        else:
            study.sync_status = "completed"
            result.successful_studies += 1

    for image_uid, image in all_images.items():
        series = all_series[image.series_uid]
        if image.image_uid not in series.image_uids:
            series.image_uids.append(image.image_uid)
            series.image_count += 1

    for series_uid, series in all_series.items():
        study = all_studies[series.study_uid]
        series.image_uids.sort(key=lambda uid: all_images[uid].instance_number)
        if series.series_uid not in study.series_uids:
            study.series_uids.append(series.series_uid)

    for study_uid, study in all_studies.items():
        study.series_uids.sort(key=lambda uid: all_series[uid].series_number)
        patient_id = study_patients[study_uid]
        if study.study_uid not in db.studies_by_patient[patient_id]:
            db.studies_by_patient[patient_id].append(study.study_uid)

    db.patients.update(all_patients)
    db.studies.update(all_studies)
    db.series.update(all_series)
    db.images.update(all_images)

    result.total_studies = len(all_studies)
    result.total_images = len(all_images)

    return result


def generate_mock_pacs_data() -> None:
    pacs_dir = settings.pacs_dir
    os.makedirs(pacs_dir, exist_ok=True)

    for mod in MODALITIES:
        os.makedirs(os.path.join(pacs_dir, mod), exist_ok=True)

    patients = [
        ("P001", "张三"),
        ("P002", "李四"),
        ("P003", "王五"),
        ("P004", "赵六"),
        ("P005", "钱七"),
    ]

    for patient_id, patient_name in patients:
        for visit_idx in range(2):
            study_uid = generate_uid()

            ct_series_uid = generate_uid()
            ct_dir = os.path.join(pacs_dir, "CT")
            generate_mock_dicom(
                output_dir=ct_dir,
                patient_id=patient_id,
                patient_name=patient_name,
                study_uid=study_uid,
                series_uid=ct_series_uid,
                modality="CT",
                num_slices=50,
                series_description="胸部CT平扫",
            )

            ct_contrast_series_uid = generate_uid()
            generate_mock_dicom(
                output_dir=ct_dir,
                patient_id=patient_id,
                patient_name=patient_name,
                study_uid=study_uid,
                series_uid=ct_contrast_series_uid,
                modality="CT",
                num_slices=60,
                series_description="胸部CT增强-动脉期",
            )

            mri_dir = os.path.join(pacs_dir, "MRI")
            mri_series_uid = generate_uid()
            generate_mock_dicom(
                output_dir=mri_dir,
                patient_id=patient_id,
                patient_name=patient_name,
                study_uid=study_uid,
                series_uid=mri_series_uid,
                modality="MRI",
                num_slices=30,
                series_description="头部MRI T1WI",
            )

            cr_dir = os.path.join(pacs_dir, "CR")
            cr_series_uid = generate_uid()
            generate_mock_dicom(
                output_dir=cr_dir,
                patient_id=patient_id,
                patient_name=patient_name,
                study_uid=study_uid,
                series_uid=cr_series_uid,
                modality="CR",
                num_slices=1,
                series_description="胸部正位",
                rows=2048,
                columns=2048,
            )
