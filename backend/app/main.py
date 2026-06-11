import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pydicom

from .config import settings
from .database import init_default_users, ensure_storage_dirs, db
from .pacs_sync import sync_from_pacs, generate_mock_pacs_data
from .dicom_utils import _safe_str
from .routers import auth, study, series, image, annotation, report, sync, admin


def _check_dicom_chinese_valid(pacs_dir: str) -> bool:
    if not os.path.isdir(pacs_dir):
        return False

    for root, dirs, files in os.walk(pacs_dir):
        for filename in files:
            if filename.lower().endswith(".dcm"):
                file_path = os.path.join(root, filename)
                try:
                    ds = pydicom.dcmread(file_path, force=True)
                    patient_name = _safe_str(ds, "PatientName", "")
                    study_desc = _safe_str(ds, "StudyDescription", "")

                    if not patient_name or patient_name == "未知患者":
                        return False

                    has_chinese_name = any("\u4e00" <= c <= "\u9fff" for c in patient_name)
                    if not has_chinese_name:
                        return False

                    if study_desc:
                        has_chinese_desc = any("\u4e00" <= c <= "\u9fff" for c in study_desc)
                        if not has_chinese_desc:
                            return False

                    return True
                except Exception:
                    continue
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_storage_dirs()
    init_default_users()

    pacs_dir = settings.pacs_dir
    has_dicom = False
    if os.path.isdir(pacs_dir):
        for root, dirs, files in os.walk(pacs_dir):
            if any(f.lower().endswith(".dcm") for f in files):
                has_dicom = True
                break

    chinese_valid = _check_dicom_chinese_valid(pacs_dir) if has_dicom else False

    if not has_dicom or not chinese_valid:
        generate_mock_pacs_data()

    sync_from_pacs()

    yield

    db.reset()


app = FastAPI(
    title="放射科影像标注系统",
    description="三甲医院放射科在线影像标注与教学系统",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(study.router, prefix="/api")
app.include_router(series.router, prefix="/api")
app.include_router(image.router, prefix="/api")
app.include_router(annotation.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "studies_count": len(db.studies),
        "images_count": len(db.images),
        "annotations_count": len(db.annotations),
        "users_count": len(db.users),
    }
