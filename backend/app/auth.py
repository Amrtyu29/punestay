"""Password hashing (PBKDF2, stdlib) and JWT sessions, plus FastAPI dependencies for the current user."""
import base64
import hashlib
import hmac
import os
import time

import jwt
from fastapi import Depends, Header, HTTPException

from .config import JWT_EXPIRE_HOURS, JWT_SECRET
from .db import get_cursor

ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2${ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, dk = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iters))
        return hmac.compare_digest(calc, base64.b64decode(dk))
    except (ValueError, TypeError):
        return False


def create_token(user: dict) -> str:
    payload = {"sub": str(user["id"]), "role": user["role"], "exp": int(time.time()) + JWT_EXPIRE_HOURS * 3600}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _user_from_header(authorization: str | None, cur) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    cur.execute("SELECT id, name, email, phone, role, trusted, created_at FROM users WHERE id = %s", (int(payload["sub"]),))
    return cur.fetchone()


def optional_user(authorization: str | None = Header(None), cur=Depends(get_cursor)) -> dict | None:
    return _user_from_header(authorization, cur)


def current_user(authorization: str | None = Header(None), cur=Depends(get_cursor)) -> dict:
    user = _user_from_header(authorization, cur)
    if not user:
        raise HTTPException(401, "Sign in to do that")
    return user


def require_role(*roles: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, f"Needs role: {', '.join(roles)}")
        return user
    return dep
