"""
Authentication handler for the Vector Indexing System.

Provides JWT-based authentication with:
- User registration and login
- Password hashing with bcrypt
- JWT token creation and verification
- FastAPI dependency injection for protected routes
- User data stored in SQLite alongside document metadata
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import METADATA_DB_PATH

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-to-a-secure-random-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    """Schema for user registration."""
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not v.isalnum() and "_" not in v:
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    """Schema for user login."""
    username: str
    password: str


class UserResponse(BaseModel):
    """Schema for user data returned to clients."""
    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    created_at: Optional[str] = None


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Schema for data encoded in JWT."""
    username: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None


# ---------------------------------------------------------------------------
# User Database
# ---------------------------------------------------------------------------

class UserDB:
    """SQLite-backed user storage."""

    def __init__(self, db_path: str = METADATA_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Create users table if it doesn't exist."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            full_name TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
        ''')
        conn.commit()
        conn.close()

    def create_user(self, user: UserCreate) -> Dict[str, Any]:
        """Create a new user. Raises ValueError if username/email exists."""
        import uuid
        user_id = str(uuid.uuid4())
        hashed = pwd_context.hash(user.password)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (id, username, email, hashed_password, full_name) "
                "VALUES (?, ?, ?, ?, ?)",
                (user_id, user.username, user.email, hashed, user.full_name or "")
            )
            conn.commit()
        except sqlite3.IntegrityError as e:
            conn.rollback()
            if "username" in str(e):
                raise ValueError(f"Username '{user.username}' already exists")
            elif "email" in str(e):
                raise ValueError(f"Email '{user.email}' already exists")
            raise ValueError("User already exists")
        finally:
            conn.close()

        return {
            "id": user_id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name or "",
            "role": "user",
            "is_active": True,
            "created_at": datetime.utcnow().isoformat()
        }

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, username, email, hashed_password, full_name, role, is_active, created_at "
                "FROM users WHERE username = ?",
                (username,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "hashed_password": row[3],
                    "full_name": row[4],
                    "role": row[5],
                    "is_active": bool(row[6]),
                    "created_at": row[7]
                }
            return None
        finally:
            conn.close()

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, username, email, hashed_password, full_name, role, is_active, created_at "
                "FROM users WHERE id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "hashed_password": row[3],
                    "full_name": row[4],
                    "role": row[5],
                    "is_active": bool(row[6]),
                    "created_at": row[7]
                }
            return None
        finally:
            conn.close()

    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify username and password. Returns user dict or None."""
        user = self.get_user_by_username(username)
        if not user:
            return None
        if not pwd_context.verify(password, user["hashed_password"]):
            return None
        if not user["is_active"]:
            return None
        return user

    def list_users(self) -> List[Dict[str, Any]]:
        """List all users (without passwords)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, username, email, full_name, role, is_active, created_at "
                "FROM users ORDER BY created_at DESC"
            )
            users = []
            for row in cursor.fetchall():
                users.append({
                    "id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "full_name": row[3],
                    "role": row[4],
                    "is_active": bool(row[5]),
                    "created_at": row[6]
                })
            return users
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# JWT Token Management
# ---------------------------------------------------------------------------

# Singleton instances
_user_db: Optional[UserDB] = None

def get_user_db() -> UserDB:
    global _user_db
    if _user_db is None:
        _user_db = UserDB()
    return _user_db


class AuthHandler:
    """Handles JWT creation, verification, and user authentication."""

    def __init__(self):
        self.secret_key = SECRET_KEY
        self.algorithm = ALGORITHM
        self.access_token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=self.access_token_expire_minutes))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify a JWT token and return its payload."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

    def register_user(self, user_data: UserCreate) -> TokenResponse:
        """Register a new user and return JWT token."""
        user_db = get_user_db()
        try:
            user = user_db.create_user(user_data)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        token = self.create_access_token({
            "sub": user["username"],
            "user_id": user["id"],
            "role": user["role"]
        })

        return TokenResponse(
            access_token=token,
            user=UserResponse(**user)
        )

    def login_user(self, login_data: UserLogin) -> TokenResponse:
        """Authenticate a user and return JWT token."""
        user_db = get_user_db()
        user = user_db.authenticate_user(login_data.username, login_data.password)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = self.create_access_token({
            "sub": user["username"],
            "user_id": user["id"],
            "role": user["role"]
        })

        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=user["id"],
                username=user["username"],
                email=user["email"],
                full_name=user["full_name"],
                role=user["role"],
                is_active=user["is_active"],
                created_at=user["created_at"]
            )
        )

    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> Dict[str, Any]:
        """FastAPI dependency: extract and verify current user from JWT."""
        token = credentials.credentials
        payload = self.verify_token(token)

        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        username = payload.get("sub")
        user_id = payload.get("user_id")
        role = payload.get("role")

        if username is None or user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_db = get_user_db()
        user = user_db.get_user_by_id(user_id)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )

        return user


# Optional auth (for endpoints that work both with and without auth)
optional_auth_scheme = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_auth_scheme),
) -> Optional[Dict[str, Any]]:
    """FastAPI dependency: return current user if token provided, None otherwise."""
    if credentials is None:
        return None

    auth = AuthHandler()
    payload = auth.verify_token(credentials.credentials)
    if payload is None:
        return None

    user_id = payload.get("user_id")
    if user_id is None:
        return None

    user_db = get_user_db()
    return user_db.get_user_by_id(user_id)