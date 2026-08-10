import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.auth import User, Role, UserRole
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_admin_can_create_user(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "email": "coordinator@lexiconmile.com",
        "password": "Password123!",
        "full_name": "Coordinator User",
        "role_names": ["crc_coordinator"],
    }
    response = await client.post("/users", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "coordinator@lexiconmile.com"


@pytest.mark.asyncio
async def test_non_admin_cannot_create_user(client: AsyncClient, db_session: AsyncSession):
    res = await db_session.execute(select(Role).where(Role.name == "crc_coordinator"))
    role = res.scalar_one()

    user = User(
        email="coord_test@lexiconmile.com",
        password_hash=get_password_hash("Password123!"),
        full_name="Coord Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    coord_token = create_access_token(subject=user.id, roles=["crc_coordinator"])
    headers = {"Authorization": f"Bearer {coord_token}"}

    payload = {
        "email": "new_user@lexiconmile.com",
        "password": "Password123!",
        "full_name": "New User",
        "role_names": ["faculty_internal"],
    }
    response = await client.post("/users", json=payload, headers=headers)
    assert response.status_code == 403
