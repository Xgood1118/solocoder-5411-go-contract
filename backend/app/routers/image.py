import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse, Response
import pydicom

from ..database import db
from ..models import User, ImageInfo, ImageLock
from ..auth import get_current_user
from ..dicom_utils import get_image_pixel_data

router = APIRouter(prefix="/images", tags=["影像"])


@router.get("/{image_uid}", response_model=ImageInfo)
async def get_image_info(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")
    return image


@router.get("/{image_uid}/dicom")
async def get_image_dicom(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    try:
        with open(image.file_path, "rb") as f:
            dicom_bytes = f.read()

        return Response(
            content=dicom_bytes,
            media_type="application/dicom",
            headers={
                "Content-Disposition": f"attachment; filename={image_uid}.dcm"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取 DICOM 文件失败: {str(e)}")


@router.get("/{image_uid}/pixels")
async def get_image_pixels(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    pixel_data = get_image_pixel_data(image_uid)
    if not pixel_data:
        raise HTTPException(status_code=500, detail="无法读取像素数据")

    image_info = {
        "image_uid": image.image_uid,
        "rows": image.rows,
        "columns": image.columns,
        "bits_stored": image.bits_stored,
        "photometric_interpretation": image.photometric_interpretation,
        "pixel_spacing": image.pixel_spacing,
        "slice_thickness": image.slice_thickness,
        "image_position_patient": image.image_position_patient,
        "image_orientation_patient": image.image_orientation_patient,
        "window_center": image.window_center,
        "window_width": image.window_width,
        "rescale_slope": image.rescale_slope,
        "rescale_intercept": image.rescale_intercept,
        "pixel_data_length": len(pixel_data),
    }

    return JSONResponse(content=image_info)


@router.get("/{image_uid}/pixeldata")
async def get_image_pixeldata_raw(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    pixel_data = get_image_pixel_data(image_uid)
    if not pixel_data:
        raise HTTPException(status_code=500, detail="无法读取像素数据")

    return Response(
        content=pixel_data,
        media_type="application/octet-stream",
    )


@router.get("/series/{series_uid}", response_model=List[ImageInfo])
async def get_series_images(
    series_uid: str,
    current_user: User = Depends(get_current_user),
):
    series = db.series.get(series_uid)
    if not series:
        raise HTTPException(status_code=404, detail="序列不存在")

    images = [db.images[uid] for uid in series.image_uids if uid in db.images]
    images.sort(key=lambda img: img.instance_number)
    return images


@router.get("/{image_uid}/lock")
async def get_image_lock(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    lock = db.image_locks.get(image_uid)
    if lock:
        return {
            "locked": True,
            "locked_by": lock.locked_by,
            "locked_by_name": lock.locked_by_name,
            "locked_at": lock.locked_at.isoformat(),
            "is_me": lock.locked_by == current_user.user_id,
        }
    else:
        return {"locked": False}


@router.post("/{image_uid}/lock")
async def acquire_image_lock(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime

    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    existing_lock = db.image_locks.get(image_uid)
    if existing_lock:
        if existing_lock.locked_by == current_user.user_id:
            return {
                "success": True,
                "locked": True,
                "locked_by": existing_lock.locked_by,
                "locked_by_name": existing_lock.locked_by_name,
                "is_me": True,
            }
        else:
            return {
                "success": False,
                "locked": True,
                "locked_by": existing_lock.locked_by,
                "locked_by_name": existing_lock.locked_by_name,
                "message": f"{existing_lock.locked_by_name}正在标注",
                "is_me": False,
            }

    lock = ImageLock(
        image_uid=image_uid,
        locked_by=current_user.user_id,
        locked_by_name=current_user.full_name,
        locked_at=datetime.utcnow(),
    )
    db.image_locks[image_uid] = lock

    return {
        "success": True,
        "locked": True,
        "locked_by": current_user.user_id,
        "locked_by_name": current_user.full_name,
        "is_me": True,
    }


@router.post("/{image_uid}/unlock")
async def release_image_lock(
    image_uid: str,
    current_user: User = Depends(get_current_user),
):
    image = db.images.get(image_uid)
    if not image:
        raise HTTPException(status_code=404, detail="影像不存在")

    lock = db.image_locks.get(image_uid)
    if not lock:
        return {"success": True, "unlocked": True}

    if lock.locked_by != current_user.user_id:
        raise HTTPException(status_code=403, detail="只有锁持有者可以释放锁")

    del db.image_locks[image_uid]
    return {"success": True, "unlocked": True}
