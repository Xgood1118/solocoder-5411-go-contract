import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    port: int = 8000
    pacs_dir: str = "./pacs_data"
    dicom_storage_dir: str = "./dicom_storage"
    secret_key: str = "your-secret-key-h-change-in-production"
    access_token_expire_minutes: int = 1440

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
