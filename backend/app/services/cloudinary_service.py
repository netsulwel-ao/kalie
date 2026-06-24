"""
Cloudinary upload service — handles image uploads for all modules.
"""
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 10


async def upload_image(file: UploadFile, folder: str = "kalie") -> str:
    """Upload an image to Cloudinary and return the secure URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de ficheiro não suportado. Use JPEG, PNG, WebP ou GIF.")

    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Ficheiro demasiado grande. Máximo {MAX_SIZE_MB}MB.")

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            resource_type="image",
            transformation=[{"quality": "auto", "fetch_format": "auto"}],
        )
        return result["secure_url"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao fazer upload da imagem: {str(e)}")


async def upload_images(files: list[UploadFile], folder: str = "kalie") -> list[str]:
    """Upload multiple images to Cloudinary and return a list of secure URLs."""
    urls: list[str] = []
    for file in files:
        if not file.filename:
            continue
        url = await upload_image(file, folder=folder)
        urls.append(url)
    return urls


async def delete_image(public_id: str) -> None:
    """Delete an image from Cloudinary by public_id."""
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        pass  # Non-critical — log but don't fail
