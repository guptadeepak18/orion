import io
import os
import mimetypes
import logging
import uuid
from typing import Dict, Any, Optional, Tuple
from fastapi import UploadFile, HTTPException

from app.core.config import settings

logger = logging.getLogger("crc_one.storage")


class StorageService:
    """
    Unified Storage Service supporting Cloudflare R2 (S3-compatible)
    with seamless local disk fallback when R2 credentials are not configured.
    """

    def __init__(self):
        self.local_base_dir = os.path.abspath(settings.FILE_STORAGE_PATH)
        os.makedirs(self.local_base_dir, exist_ok=True)
        self._s3_client = None

    def is_r2_active(self) -> bool:
        return bool(
            settings.R2_ACCOUNT_ID
            and settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
            and settings.R2_BUCKET_NAME
        )

    def _get_s3_client(self):
        if not self.is_r2_active():
            return None
        if self._s3_client is None:
            try:
                import boto3
                from botocore.config import Config

                endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=endpoint_url,
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    region_name="auto",
                    config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
                )
                logger.info(f"[Storage] Cloudflare R2 S3 client initialized for bucket '{settings.R2_BUCKET_NAME}'")
            except Exception as e:
                logger.error(f"[Storage] Failed to initialize Cloudflare R2 client: {e}")
                self._s3_client = None
        return self._s3_client

    async def upload_file(
        self,
        file: UploadFile,
        folder: str = "lms",
        max_size_bytes: int = 50 * 1024 * 1024,
    ) -> Dict[str, Any]:
        """
        Uploads an UploadFile to Cloudflare R2 (or local disk fallback) using 64KB chunk streaming.
        """
        clean_filename = os.path.basename(file.filename or "uploaded_file")
        unique_name = f"{uuid.uuid4().hex}_{clean_filename}"
        storage_key = f"{folder}/{unique_name}"

        content_type = file.content_type
        if not content_type or content_type == "application/octet-stream":
            guessed, _ = mimetypes.guess_type(clean_filename)
            content_type = guessed or "application/octet-stream"

        s3 = self._get_s3_client()

        if s3:
            # --- Cloudflare R2 Storage ---
            buffer = io.BytesIO()
            total_bytes = 0
            chunk_size = 64 * 1024

            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_size_bytes:
                    raise ValueError(f"File exceeds maximum allowed size of {max_size_bytes // (1024 * 1024)}MB.")
                buffer.write(chunk)

            buffer.seek(0)
            try:
                s3.upload_fileobj(
                    Fileobj=buffer,
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=storage_key,
                    ExtraArgs={
                        "ContentType": content_type,
                        "ContentDisposition": f'inline; filename="{clean_filename}"',
                    },
                )
                logger.info(f"[Storage] Uploaded {storage_key} ({total_bytes} bytes) to Cloudflare R2")
            except Exception as e:
                logger.error(f"[Storage] R2 upload failed for {storage_key}: {e}")
                raise RuntimeError(f"Cloudflare R2 storage upload failed: {str(e)}")

            if settings.R2_PUBLIC_URL:
                public_base = settings.R2_PUBLIC_URL.rstrip("/")
                file_url = f"{public_base}/{storage_key}"
            else:
                file_url = f"/api/v1/storage/file?key={storage_key}"

            return {
                "saved_filename": storage_key,
                "original_filename": clean_filename,
                "file_path": storage_key,
                "file_url": file_url,
                "file_size": total_bytes,
                "storage_provider": "r2",
                "content_type": content_type,
            }

        else:
            # --- Local Disk Storage Fallback ---
            target_dir = os.path.join(self.local_base_dir, folder)
            os.makedirs(target_dir, exist_ok=True)
            dest_path = os.path.join(target_dir, unique_name)

            total_bytes = 0
            chunk_size = 64 * 1024

            try:
                with open(dest_path, "wb") as f_out:
                    while True:
                        chunk = await file.read(chunk_size)
                        if not chunk:
                            break
                        total_bytes += len(chunk)
                        if total_bytes > max_size_bytes:
                            f_out.close()
                            if os.path.exists(dest_path):
                                os.remove(dest_path)
                            raise ValueError(f"File exceeds maximum allowed size of {max_size_bytes // (1024 * 1024)}MB.")
                        f_out.write(chunk)
            except Exception:
                if os.path.exists(dest_path):
                    try:
                        os.remove(dest_path)
                    except Exception:
                        pass
                raise

            logger.info(f"[Storage] Uploaded {storage_key} ({total_bytes} bytes) to local disk: {dest_path}")
            return {
                "saved_filename": storage_key,
                "original_filename": clean_filename,
                "file_path": dest_path,
                "file_url": f"/api/v1/storage/file?key={storage_key}",
                "file_size": total_bytes,
                "storage_provider": "local",
                "content_type": content_type,
            }

    async def upload_bytes(
        self,
        data: bytes,
        filename: str,
        folder: str = "lms",
        content_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Uploads raw bytes to Cloudflare R2 or local disk fallback.
        """
        clean_filename = os.path.basename(filename)
        unique_name = f"{uuid.uuid4().hex}_{clean_filename}"
        storage_key = f"{folder}/{unique_name}"

        if not content_type:
            guessed, _ = mimetypes.guess_type(clean_filename)
            content_type = guessed or "application/octet-stream"

        s3 = self._get_s3_client()
        total_bytes = len(data)

        if s3:
            buffer = io.BytesIO(data)
            s3.upload_fileobj(
                Fileobj=buffer,
                Bucket=settings.R2_BUCKET_NAME,
                Key=storage_key,
                ExtraArgs={
                    "ContentType": content_type,
                    "ContentDisposition": f'inline; filename="{clean_filename}"',
                },
            )
            if settings.R2_PUBLIC_URL:
                file_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{storage_key}"
            else:
                file_url = f"/api/v1/storage/file?key={storage_key}"

            return {
                "saved_filename": storage_key,
                "original_filename": clean_filename,
                "file_path": storage_key,
                "file_url": file_url,
                "file_size": total_bytes,
                "storage_provider": "r2",
                "content_type": content_type,
            }
        else:
            target_dir = os.path.join(self.local_base_dir, folder)
            os.makedirs(target_dir, exist_ok=True)
            dest_path = os.path.join(target_dir, unique_name)
            with open(dest_path, "wb") as f_out:
                f_out.write(data)

            return {
                "saved_filename": storage_key,
                "original_filename": clean_filename,
                "file_path": dest_path,
                "file_url": f"/api/v1/storage/file?key={storage_key}",
                "file_size": total_bytes,
                "storage_provider": "local",
                "content_type": content_type,
            }

    def read_file_bytes_sync(self, key_or_path: str) -> bytes:
        """
        Synchronously reads raw bytes of a file from local disk, Cloudflare R2, or HTTP URL.
        """
        # 1. Existing local file
        if os.path.exists(key_or_path):
            try:
                with open(key_or_path, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"[Storage] Local read failed for '{key_or_path}': {e}")

        # 2. HTTP/HTTPS URL
        if key_or_path.startswith("http://") or key_or_path.startswith("https://"):
            try:
                import httpx
                resp = httpx.get(key_or_path, timeout=15.0)
                if resp.status_code == 200:
                    return resp.content
                logger.warning(f"[Storage] HTTP GET {resp.status_code} for '{key_or_path}'")
            except Exception as e:
                logger.warning(f"[Storage] HTTP download failed for '{key_or_path}': {e}")

        # 3. Clean R2 key
        clean_key = key_or_path.replace("\\\\", "/").replace("\\", "/").lstrip("/")
        if "r2.dev/" in clean_key:
            clean_key = clean_key.split("r2.dev/")[-1]
        elif "cloudflarestorage.com/" in clean_key:
            clean_key = clean_key.split("cloudflarestorage.com/")[-1]

        # 4. Direct S3 Get Object
        s3 = self._get_s3_client()
        if s3:
            try:
                resp = s3.get_object(Bucket=settings.R2_BUCKET_NAME, Key=clean_key)
                return resp["Body"].read()
            except Exception as e:
                logger.warning(f"[Storage] R2 get_object failed for '{clean_key}': {e}")

        # 5. Public R2 URL fallback
        if settings.R2_PUBLIC_URL:
            pub_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{clean_key}"
            try:
                import httpx
                resp = httpx.get(pub_url, timeout=15.0)
                if resp.status_code == 200:
                    return resp.content
            except Exception as e:
                logger.warning(f"[Storage] Public R2 URL download failed for '{pub_url}': {e}")

        # 6. Local directory search fallback
        possible_local_paths = [
            os.path.join(self.local_base_dir, clean_key),
            os.path.join(self.local_base_dir, "lms", os.path.basename(clean_key)),
            os.path.join(self.local_base_dir, "case_studies", os.path.basename(clean_key)),
            os.path.join(self.local_base_dir, "session_plans", os.path.basename(clean_key)),
        ]
        for p in possible_local_paths:
            if os.path.exists(p):
                with open(p, "rb") as f:
                    return f.read()

        raise FileNotFoundError(f"File not found in R2 or local storage: '{key_or_path}'")

    async def read_file_bytes(self, key_or_path: str) -> bytes:
        """
        Reads raw bytes of a file from R2 or local disk (delegates to read_file_bytes_sync).
        """
        return self.read_file_bytes_sync(key_or_path)

    async def delete_file(self, key_or_path: str) -> bool:
        """
        Deletes a file from R2 or local disk.
        """
        s3 = self._get_s3_client()
        clean_key = key_or_path.replace("\\\\", "/").replace("\\", "/").lstrip("/")

        deleted = False
        if s3:
            try:
                s3.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=clean_key)
                deleted = True
            except Exception as e:
                logger.warning(f"[Storage] R2 delete failed for '{clean_key}': {e}")

        possible_local_paths = [
            key_or_path if os.path.isabs(key_or_path) else "",
            os.path.join(self.local_base_dir, clean_key),
            os.path.join(self.local_base_dir, "lms", os.path.basename(clean_key)),
        ]
        for p in possible_local_paths:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                    deleted = True
                except Exception:
                    pass

        return deleted


storage_service = StorageService()
