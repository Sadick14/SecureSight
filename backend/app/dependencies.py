from fastapi import Depends, HTTPException, Request, status
from app.models.schemas import GitHubUser

async def get_current_user(request: Request) -> GitHubUser:
    """Dependency to verify and get current user"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = auth_header.split(" ")[1]
    try:
        # In production, verify the token properly
        return GitHubUser(
            id=12345,
            login="testuser",
            name="Test User",
            avatar_url="https://example.com/avatar.jpg",
            access_token=token
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )