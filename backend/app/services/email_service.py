"""
Email service — Hostinger SMTP via fastapi-mail.
"""
from functools import cached_property
from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.core.config import settings


class _MailHelper:
    """Lazy mail config — avoids crash when SMTP env vars are empty in dev."""

    @cached_property
    def config(self) -> ConnectionConfig | None:
        if not settings.EMAILS_FROM_EMAIL:
            return None
        return ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USER,
            MAIL_PASSWORD=settings.SMTP_PASSWORD,
            MAIL_FROM=settings.EMAILS_FROM_EMAIL,
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_SERVER=settings.SMTP_HOST,
            MAIL_FROM_NAME=settings.EMAILS_FROM_NAME,
            MAIL_STARTTLS=settings.SMTP_PORT == 587,
            MAIL_SSL_TLS=settings.SMTP_PORT == 465,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
        )

    @cached_property
    def fm(self) -> FastMail | None:
        cfg = self.config
        return FastMail(cfg) if cfg else None


_mail = _MailHelper()

FRONTEND_URL = "http://localhost:5173"  # override via env in prod


class EmailService:
    async def send_verification_email(self, email: str, name: str, token: str) -> None:
        verify_url = f"{FRONTEND_URL}/verificar-email?token={token}"
        html = f"""
        <div style="font-family: Inter, sans-serif; background: #141313; color: #e5e2e1; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
            <h1 style="font-family: 'Space Grotesk', sans-serif; color: #c9c6c5;">Bem-vindo ao Kalie, {name}!</h1>
            <p>Clique no botão abaixo para verificar o seu email e activar a sua conta.</p>
            <a href="{verify_url}" style="display: inline-block; background: #00E5FF; color: #141313; padding: 14px 32px; border-radius: 9999px; font-weight: 600; text-decoration: none; margin: 24px 0;">
                Verificar Email
            </a>
            <p style="color: #8e9192; font-size: 14px;">Este link expira em 24 horas. Se não criou uma conta, ignore este email.</p>
        </div>
        """
        message = MessageSchema(
            subject="Verifique o seu email — Kalie",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )
        if _mail.fm is None:
            print("⚠ Email not configured — skipping verification email")
            return
        await _mail.fm.send_message(message)

    async def send_password_reset_email(self, email: str, name: str, token: str) -> None:
        reset_url = f"{FRONTEND_URL}/redefinir-senha?token={token}"
        html = f"""
        <div style="font-family: Inter, sans-serif; background: #141313; color: #e5e2e1; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
            <h1 style="font-family: 'Space Grotesk', sans-serif; color: #c9c6c5;">Redefinir Senha</h1>
            <p>Olá {name}, recebemos um pedido para redefinir a sua senha.</p>
            <a href="{reset_url}" style="display: inline-block; background: #FF4D2E; color: #fff; padding: 14px 32px; border-radius: 9999px; font-weight: 600; text-decoration: none; margin: 24px 0;">
                Redefinir Senha
            </a>
            <p style="color: #8e9192; font-size: 14px;">Este link expira em 1 hora. Se não solicitou a redefinição, ignore este email.</p>
        </div>
        """
        message = MessageSchema(
            subject="Redefinição de senha — Kalie",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )
        await _mail.fm.send_message(message)
