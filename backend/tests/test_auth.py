import pytest
from httpx import AsyncClient
from app.models.auth import User


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user: User):
    response = await client.post(
        "/auth/login",
        json={"email": admin_user.email, "password": "Password123!"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == admin_user.email
    assert "crc_admin" in data["user"]["roles"]


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, admin_user: User):
    response = await client.post(
        "/auth/login",
        json={"email": admin_user.email, "password": "WrongPassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, admin_user: User):
    login_res = await client.post(
        "/auth/login",
        json={"email": admin_user.email, "password": "Password123!"},
    )
    refresh_token = login_res.json()["data"]["refresh_token"]

    response = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = await client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["email"] == "admin_test@lexiconmile.com"
