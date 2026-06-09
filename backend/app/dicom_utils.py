import os
import uuid
import shutil
import pydicom
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
from pydicom.charset import decode_bytes
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .config import settings
from .models import StudyInfo, SeriesInfo, ImageInfo, PatientInfo
from .database import db


CHINESE_CHARSETS = ["GB18030", "GBK", "GB2312", "UTF8", "ISO_IR 192"]


def _decode_dicom_str(value, default_charset="GB18030") -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        if "\ufffd" in value or any(ord(c) > 127 and ord(c) < 256 for c in value):
            try:
                raw_bytes = value.encode("latin-1", errors="ignore")
                for cs in CHINESE_CHARSETS:
                    try:
                        decoded = raw_bytes.decode(cs)
                        if decoded and "\ufffd" not in decoded:
                            return decoded
                    except (UnicodeDecodeError, LookupError):
                        continue
            except Exception:
                pass
        return value
    if isinstance(value, bytes):
        for cs in CHINESE_CHARSETS:
            try:
                return value.decode(cs)
            except (UnicodeDecodeError, LookupError):
                continue
        return value.decode("utf-8", errors="replace")
    return str(value)


def _safe_str(ds, tag, default="") -> str:
    try:
        val = ds.get(tag, default)
        if val is None:
            return default
        if hasattr(val, "__len__") and not isinstance(val, (str, bytes)):
            if len(val) > 0:
                val = val[0]
            else:
                return default
        return _decode_dicom_str(val)
    except Exception:
        return default


def extract_dicom_info(file_path: str) -> Tuple[PatientInfo, StudyInfo, SeriesInfo, ImageInfo]:
    ds = pydicom.dcmread(file_path)

    patient_id = _safe_str(ds, "PatientID", "UNKNOWN")
    patient_name = _safe_str(ds, "PatientName", "未知患者")
    patient_sex = _safe_str(ds, "PatientSex", "") or None
    patient_age = _safe_str(ds, "PatientAge", "") or None

    study_uid = str(ds.StudyInstanceUID)
    study_date = _safe_str(ds, "StudyDate", "")
    study_time = _safe_str(ds, "StudyTime", "")
    study_description = _safe_str(ds, "StudyDescription", "") or None
    modality = _safe_str(ds, "Modality", "UNKNOWN")

    series_uid = str(ds.SeriesInstanceUID)
    series_number = int(ds.get("SeriesNumber", 0))
    series_description = _safe_str(ds, "SeriesDescription", "") or None

    image_uid = str(ds.SOPInstanceUID)
    instance_number = int(ds.get("InstanceNumber", 0))
    rows = int(ds.get("Rows", 512))
    columns = int(ds.get("Columns", 512))

    pixel_spacing = None
    if hasattr(ds, "PixelSpacing"):
        pixel_spacing = [float(x) for x in ds.PixelSpacing]

    slice_thickness = float(ds.SliceThickness) if hasattr(ds, "SliceThickness") else None

    image_position_patient = None
    if hasattr(ds, "ImagePositionPatient"):
        image_position_patient = [float(x) for x in ds.ImagePositionPatient]

    image_orientation_patient = None
    if hasattr(ds, "ImageOrientationPatient"):
        image_orientation_patient = [float(x) for x in ds.ImageOrientationPatient]

    bits_stored = int(ds.get("BitsStored", 16))
    photometric_interpretation = str(ds.get("PhotometricInterpretation", "MONOCHROME2"))

    window_center = None
    window_width = None
    if hasattr(ds, "WindowCenter"):
        wc = ds.WindowCenter
        if isinstance(wc, list) and len(wc) > 0:
            window_center = float(wc[0])
        else:
            window_center = float(wc)
    if hasattr(ds, "WindowWidth"):
        ww = ds.WindowWidth
        if isinstance(ww, list) and len(ww) > 0:
            window_width = float(ww[0])
        else:
            window_width = float(ww)

    rescale_slope = float(ds.get("RescaleSlope", 1.0))
    rescale_intercept = float(ds.get("RescaleIntercept", 0.0))

    patient = PatientInfo(
        patient_id=patient_id,
        patient_name=patient_name,
        patient_sex=patient_sex,
        patient_age=patient_age,
    )

    study = StudyInfo(
        study_uid=study_uid,
        patient_id=patient_id,
        study_date=study_date,
        study_time=study_time,
        study_description=study_description,
        modalities_in_study=[modality],
        series_uids=[],
        sync_status="completed",
        sync_errors=[],
    )

    series = SeriesInfo(
        series_uid=series_uid,
        study_uid=study_uid,
        series_number=series_number,
        series_description=series_description,
        modality=modality,
        image_count=0,
        image_uids=[],
    )

    image = ImageInfo(
        image_uid=image_uid,
        series_uid=series_uid,
        study_uid=study_uid,
        instance_number=instance_number,
        file_path=file_path,
        rows=rows,
        columns=columns,
        pixel_spacing=pixel_spacing,
        slice_thickness=slice_thickness,
        image_position_patient=image_position_patient,
        image_orientation_patient=image_orientation_patient,
        bits_stored=bits_stored,
        photometric_interpretation=photometric_interpretation,
        window_center=window_center,
        window_width=window_width,
        rescale_slope=rescale_slope,
        rescale_intercept=rescale_intercept,
    )

    return patient, study, series, image


def get_image_pixel_data(image_uid: str) -> Optional[bytes]:
    image_info = db.images.get(image_uid)
    if not image_info:
        return None

    try:
        ds = pydicom.dcmread(image_info.file_path)
        pixel_data = ds.PixelData
        return pixel_data
    except Exception:
        return None


def get_image_array(image_uid: str) -> Optional[np.ndarray]:
    image_info = db.images.get(image_uid)
    if not image_info:
        return None

    try:
        ds = pydicom.dcmread(image_info.file_path)
        return ds.pixel_array
    except Exception:
        return None


def generate_mock_dicom(
    output_dir: str,
    patient_id: str,
    patient_name: str,
    study_uid: str,
    series_uid: str,
    modality: str,
    num_slices: int,
    series_description: str = "",
    rows: int = 512,
    columns: int = 512,
) -> List[str]:
    os.makedirs(output_dir, exist_ok=True)
    file_paths = []

    pixel_spacing = [0.5, 0.5]
    slice_thickness = 1.0
    spacing_between_slices = 1.0

    for i in range(num_slices):
        sop_instance_uid = generate_uid()

        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
        file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

        ds = FileDataset(
            None, {}, file_meta=file_meta, preamble=b"\x00" * 128
        )

        ds.SpecificCharacterSet = "GB18030"

        ds.PatientID = patient_id
        ds.PatientName = patient_name
        ds.PatientSex = "M"
        ds.PatientAge = "045Y"

        ds.StudyInstanceUID = study_uid
        ds.SeriesInstanceUID = series_uid
        ds.SOPInstanceUID = sop_instance_uid

        ds.StudyDate = datetime.now().strftime("%Y%m%d")
        ds.StudyTime = datetime.now().strftime("%H%M%S")
        ds.SeriesDate = datetime.now().strftime("%Y%m%d")
        ds.SeriesTime = datetime.now().strftime("%H%M%S")
        ds.ContentDate = datetime.now().strftime("%Y%m%d")
        ds.ContentTime = datetime.now().strftime("%H%M%S")

        ds.Modality = modality
        ds.SeriesNumber = 1
        ds.InstanceNumber = i + 1
        ds.StudyDescription = f"{modality} 检查"
        ds.SeriesDescription = series_description or f"{modality} 序列"
        ds.InstitutionName = "模拟医院"
        ds.ReferringPhysicianName = "王医生"

        ds.Rows = rows
        ds.Columns = columns
        ds.BitsAllocated = 16
        ds.BitsStored = 12
        ds.HighBit = 11
        ds.PixelRepresentation = 0
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.SamplesPerPixel = 1

        ds.PixelSpacing = pixel_spacing
        ds.SliceThickness = slice_thickness
        ds.ImagePositionPatient = [0, 0, i * spacing_between_slices]
        ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]

        ds.WindowCenter = 40
        ds.WindowWidth = 400
        ds.RescaleSlope = 1.0
        ds.RescaleIntercept = -1024 if modality == "CT" else 0

        center_x, center_y = columns // 2, rows // 2
        y, x = np.ogrid[:rows, :columns]
        dist_from_center = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)

        pixel_array = np.random.normal(50, 10, (rows, columns)).astype(np.int16)

        mask = dist_from_center < min(rows, columns) * 0.35
        pixel_array[mask] = np.random.normal(800, 100, mask.sum()).astype(np.int16)

        nodule_mask = (dist_from_center > 80) & (dist_from_center < 90) & (x > center_x + 20)
        pixel_array[nodule_mask] = np.random.normal(1200, 50, nodule_mask.sum()).astype(np.int16)

        bone_mask = dist_from_center < 15
        pixel_array[bone_mask] = np.random.normal(2500, 200, bone_mask.sum()).astype(np.int16)

        pixel_array = np.clip(pixel_array, 0, 4095).astype(np.uint16)

        ds.PixelData = pixel_array.tobytes()

        file_name = f"{modality}_{patient_id}_{i+1:04d}.dcm"
        file_path = os.path.join(output_dir, file_name)
        ds.save_as(file_path, write_like_original=False)
        file_paths.append(file_path)

    return file_paths
