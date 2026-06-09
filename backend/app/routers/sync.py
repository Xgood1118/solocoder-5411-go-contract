from fastapi import APIRouter, Depends
from ..models import User, SyncResult
from ..auth import get_current_user, require_role, UserRole
from ..pacs_sync import sync_from_pacs, generate_mock_pacs_data

router = APIRouter(prefix="/sync", tags=["同步"])


@router.post("", response_model=SyncResult)
async def sync_pacs(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.REVIEWER)),
):
    result = sync_from_pacs()
    return result


@router.post("/generate-mock", response_model=SyncResult)
async def generate_mock_data_and_sync(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    generate_mock_pacs_data()
    result = sync_from_pacs()
    return result
