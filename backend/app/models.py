from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    DOCTOR = "doctor"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class AnnotationStatus(str, Enum):
    ACTIVE = "active"
    REJECTED = "rejected"
    PENDING = "pending"


class AnnotationType(str, Enum):
    RECTANGLE = "rectangle"
    ELLIPSE = "ellipse"
    ARROW = "arrow"
    FREEHAND = "freehand"
    TEXT = "text"


class AnnotationCategory(str, Enum):
    NODULE = "结节"
    MASS = "肿块"
    CALCIFICATION = "钙化"
    LYMPH_NODE = "可疑淋巴"


class User(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: UserRole
    hashed_password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


class PatientInfo(BaseModel):
    patient_id: str
    patient_name: str
    patient_sex: Optional[str] = None
    patient_age: Optional[str] = None


class ImageInfo(BaseModel):
    image_uid: str
    series_uid: str
    study_uid: str
    instance_number: int
    file_path: str
    rows: int
    columns: int
    pixel_spacing: Optional[List[float]] = None
    slice_thickness: Optional[float] = None
    image_position_patient: Optional[List[float]] = None
    image_orientation_patient: Optional[List[float]] = None
    bits_stored: int = 16
    photometric_interpretation: str = "MONOCHROME2"
    window_center: Optional[float] = None
    window_width: Optional[float] = None
    rescale_slope: float = 1.0
    rescale_intercept: float = 0.0


class SeriesInfo(BaseModel):
    series_uid: str
    study_uid: str
    series_number: int
    series_description: Optional[str] = None
    modality: str
    image_count: int = 0
    image_uids: List[str] = []


class StudyInfo(BaseModel):
    study_uid: str
    patient_id: str
    study_date: str
    study_time: str
    study_description: Optional[str] = None
    modalities_in_study: List[str] = []
    series_uids: List[str] = []
    sync_status: str = "completed"
    sync_errors: List[str] = []


class AnnotationPoint(BaseModel):
    x: float
    y: float


class Annotation(BaseModel):
    annotation_id: str
    image_uid: str
    series_uid: str
    study_uid: str
    annotation_type: AnnotationType
    category: Optional[AnnotationCategory] = None
    label: Optional[str] = None
    points: List[AnnotationPoint]
    text_content: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: datetime
    status: AnnotationStatus = AnnotationStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None


class Report(BaseModel):
    report_id: str
    study_uid: str
    series_uid: Optional[str] = None
    content: str
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime


class ImageLock(BaseModel):
    image_uid: str
    locked_by: str
    locked_by_name: str
    locked_at: datetime


class SyncResult(BaseModel):
    total_studies: int = 0
    successful_studies: int = 0
    failed_studies: int = 0
    errors: List[str] = []
    total_images: int = 0
