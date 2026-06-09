import os
import shutil
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import uuid

from .models import (
    User, UserRole, StudyInfo, SeriesInfo, ImageInfo,
    Annotation, AnnotationStatus, Report, ImageLock, PatientInfo
)
from .config import settings


class InMemoryDB:
    def __init__(self):
        self.users: Dict[str, User] = {}
        self.patients: Dict[str, PatientInfo] = {}
        self.studies: Dict[str, StudyInfo] = {}
        self.series: Dict[str, SeriesInfo] = {}
        self.images: Dict[str, ImageInfo] = {}
        self.annotations: Dict[str, Annotation] = {}
        self.reports: Dict[str, Report] = {}
        self.image_locks: Dict[str, ImageLock] = {}
        self.studies_by_patient: Dict[str, List[str]] = defaultdict(list)
        self.annotations_by_image: Dict[str, List[str]] = defaultdict(list)
        self.annotations_by_user: Dict[str, List[str]] = defaultdict(list)

    def reset(self):
        self.__init__()


db = InMemoryDB()


def init_default_users():
    default_users = [
        User(
            user_id="admin1",
            username="admin",
            full_name="系统管理员",
            role=UserRole.ADMIN,
            hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
        ),
        User(
            user_id="doctor1",
            username="zhang",
            full_name="张医生",
            role=UserRole.DOCTOR,
            hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
        ),
        User(
            user_id="doctor2",
            username="li",
            full_name="李医生",
            role=UserRole.DOCTOR,
            hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
        ),
        User(
            user_id="reviewer1",
            username="wang",
            full_name="王主任",
            role=UserRole.REVIEWER,
            hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
        ),
    ]
    for user in default_users:
        db.users[user.user_id] = user


def ensure_storage_dirs():
    os.makedirs(settings.dicom_storage_dir, exist_ok=True)
    os.makedirs(settings.pacs_dir, exist_ok=True)

    modalities = ["CT", "MRI", "CR", "DX", "US"]
    for mod in modalities:
        os.makedirs(os.path.join(settings.pacs_dir, mod), exist_ok=True)
