from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..auth import create_token, current_user, hash_password, verify_password
from ..config import ADMIN_EMAIL, ADMIN_SETUP_TOKEN
from ..db import get_cursor

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str | None = Field(default=None, pattern=r"^[0-9+\- ]{8,15}$")
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "owner"] = "student"
    admin_token: str | None = Field(default=None, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _public(user: dict) -> dict:
    out = {k: user[k] for k in ("id", "name", "email", "phone", "role")}
    out["trusted"] = bool(user.get("trusted")) or user["role"] == "admin"
    return out


@router.post("/register", summary="Create a student or owner account")
def register(body: RegisterIn, cur=Depends(get_cursor)):
    email = body.email.lower()
    role = body.role
    if ADMIN_EMAIL and email == ADMIN_EMAIL:
        if not ADMIN_SETUP_TOKEN or body.admin_token != ADMIN_SETUP_TOKEN:
            raise HTTPException(403, "This email is reserved for the admin; the setup token is wrong or missing")
        role = "admin"
    try:
        cur.execute(
            """INSERT INTO users (name, email, phone, password_hash, role, trusted)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, name, email, phone, role, trusted, created_at""",
            (body.name.strip(), email, body.phone, hash_password(body.password), role, role == "admin"),
        )
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "An account with this email already exists")
    user = cur.fetchone()
    return {"token": create_token(user), "user": _public(user)}


@router.post("/login", summary="Sign in, returns a bearer token")
def login(body: LoginIn, cur=Depends(get_cursor)):
    cur.execute("SELECT id, name, email, phone, role, trusted, password_hash FROM users WHERE email = %s", (body.email.lower(),))
    user = cur.fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {"token": create_token(user), "user": _public(user)}


@router.get("/me", summary="The signed-in user")
def me(user: dict = Depends(current_user)):
    return _public(user)
