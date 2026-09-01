from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_token_payload
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserSummary,
    ForgotPasswordRequest,
    ForgotPasswordVerifyRequest,
    ForgotPasswordResetRequest,
    ChangePasswordConfirmRequest,
)
from app.schemas.user import UserUpdate
from app.schemas.common import ResponseEnvelope
from app.schemas.student_registration import (
    StudentRegisterRequest,
    StudentVerifyEmailRequest,
    StudentResendVerificationRequest,
    StudentRegistrationStatusResponse,
    StudentRegistrationResponse,
)
from app.services.auth_service import (
    authenticate_user,
    refresh_access_token,
    request_password_reset,
    verify_password_reset_otp,
    reset_password_with_otp,
    request_change_password_otp,
    confirm_change_password,
)
from app.services.user_service import get_user_by_id
from app.services import student_registration_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=ResponseEnvelope[TokenResponse])
async def login(
    login_data: LoginRequest, db: AsyncSession = Depends(get_db)
):
    token_response = await authenticate_user(db, login_data)
    if not token_response:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return ResponseEnvelope(data=token_response)


@router.post("/refresh", response_model=ResponseEnvelope[TokenResponse])
async def refresh_token(
    refresh_data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)
):
    token_response = await refresh_access_token(db, refresh_data.refresh_token)
    if not token_response:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return ResponseEnvelope(data=token_response)


@router.post("/logout", response_model=ResponseEnvelope[dict])
async def logout(payload: dict = Depends(get_current_token_payload)):
    # JWT logout can be handled client-side by discarding tokens; optional token blocklist
    return ResponseEnvelope(data={"message": "Successfully logged out"})


@router.get("/me", response_model=ResponseEnvelope[UserSummary])
async def get_me(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = await get_user_by_id(db, user_id_str)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_summary = UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        roles=[role.name for role in user.roles],
    )
    return ResponseEnvelope(data=user_summary)


@router.put("/me", response_model=ResponseEnvelope[UserSummary])
async def update_me(
    user_update: UserUpdate,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await get_user_by_id(db, user_id_str)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.full_name is not None:
        user.full_name = user_update.full_name.strip()
    if user_update.phone is not None:
        user.phone = user_update.phone.strip() if user_update.phone else None
    if user_update.avatar_url is not None:
        user.avatar_url = user_update.avatar_url.strip() if user_update.avatar_url else None

    await db.commit()
    await db.refresh(user)

    user_summary = UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        roles=[role.name for role in user.roles],
    )
    return ResponseEnvelope(data=user_summary)


@router.post("/me/avatar", response_model=ResponseEnvelope[UserSummary])
async def upload_my_avatar(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Direct avatar upload or avatar synchronization for the current user profile.
    """
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await get_user_by_id(db, user_id_str)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_summary = UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        roles=[role.name for role in user.roles],
    )
    return ResponseEnvelope(data=user_summary)


# ─── Student Self-Registration ──────────────────────────────────────────────

@router.post("/register", response_model=ResponseEnvelope[dict], status_code=status.HTTP_201_CREATED)
async def register_student(data: StudentRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Public endpoint — student self-registers. Sends OTP to their official email."""
    try:
        reg = await student_registration_service.create_registration(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data={
        "message": f"Registration submitted. A 6-digit verification code has been sent to {reg.email}.",
        "email": reg.email,
    })


@router.post("/verify-email", response_model=ResponseEnvelope[dict])
async def verify_email(body: StudentVerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Public endpoint — verifies the OTP sent to the student's email."""
    try:
        reg = await student_registration_service.verify_email(db, body.email, body.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data={
        "message": "Email verified successfully. Your registration is now pending admin review.",
        "status": reg.status,
    })


@router.post("/resend-verification", response_model=ResponseEnvelope[dict])
async def resend_verification(body: StudentResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    """Public endpoint — resends a new OTP to the student's email."""
    try:
        await student_registration_service.resend_verification(db, body.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data={"message": "A new verification code has been sent to your email."})


@router.get("/registration-status", response_model=ResponseEnvelope[StudentRegistrationStatusResponse])
async def get_registration_status(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated endpoint — student checks their own registration status."""
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await get_user_by_id(db, user_id_str)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reg = await student_registration_service.get_registration_by_email(db, user.email)
    if not reg:
        raise HTTPException(status_code=404, detail="No registration record found")

    return ResponseEnvelope(data=StudentRegistrationStatusResponse(
        status=reg.status,
        rejection_reason=reg.rejection_reason,
        full_name=reg.full_name,
        email=reg.email,
        is_email_verified=reg.is_email_verified,
        submitted_at=reg.created_at,
    ))


# ─── Password Reset & Profile Password Change ─────────────────────────────────

@router.post("/forgot-password/request-otp", response_model=ResponseEnvelope[dict])
async def forgot_password_request_otp(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: User submits their registered email.
    Generates a 6-digit OTP and sends it to their email via Hostinger Mail API.
    """
    try:
        await request_password_reset(db, body.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data={
        "message": f"A 6-digit password reset verification code has been sent to {body.email}.",
        "email": body.email,
    })


@router.post("/forgot-password/verify-otp", response_model=ResponseEnvelope[dict])
async def forgot_password_verify_otp(
    body: ForgotPasswordVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Validates that the submitted OTP code is correct and unexpired.
    """
    try:
        await verify_password_reset_otp(db, body.email, body.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data={
        "message": "Verification code is valid. You may now set your new password.",
        "verified": True,
    })


@router.post("/forgot-password/reset", response_model=ResponseEnvelope[dict])
async def forgot_password_reset(
    body: ForgotPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Verifies OTP code and updates the account password.
    """
    try:
        await reset_password_with_otp(db, body.email, body.code, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data={
        "message": "Password updated successfully. You can now log in with your new credentials.",
        "success": True,
    })


@router.post("/change-password/request-otp", response_model=ResponseEnvelope[dict])
async def change_password_request_otp_endpoint(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticated endpoint: Logged-in user requests a verification OTP sent to their email
    to authorize a password change from their profile.
    """
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        await request_change_password_otp(db, user_id_str)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ResponseEnvelope(data={
        "message": "Verification code has been dispatched to your registered email address.",
    })


@router.post("/change-password/confirm", response_model=ResponseEnvelope[dict])
async def change_password_confirm_endpoint(
    body: ChangePasswordConfirmRequest,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticated endpoint: Logged-in user verifies OTP and updates password from profile.
    """
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        await confirm_change_password(db, user_id_str, body.code, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ResponseEnvelope(data={
        "message": "Password updated successfully.",
        "success": True,
    })

