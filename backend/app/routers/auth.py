from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse, JSONResponse
import httpx
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional

load_dotenv()

router = APIRouter()

# Pydantic model for GitHub user response
class GitHubUser(BaseModel):
    id: int
    login: str
    name: Optional[str]
    avatar_url: Optional[str]
    access_token: str

# Environment variables
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:3000/auth/callback")

@router.get("/auth/github")
async def start_github_auth():
    """Initiate GitHub OAuth flow with proper redirect"""
    try:
        auth_url = (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={GITHUB_CLIENT_ID}"
            f"&redirect_uri={REDIRECT_URI}"
            f"&scope=user:email"
        )
        return RedirectResponse(url=auth_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initializing GitHub auth: {str(e)}"
        )

@router.get("/auth/callback")
async def handle_github_callback(code: str):
    """Handle GitHub OAuth callback with proper validation"""
    try:
        # Validate input parameters
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code"
            )

        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                params={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code
                },
                headers={"Accept": "application/json"}
            )

            token_data = token_response.json()

            if "error" in token_data:
                error_msg = token_data.get("error_description", "GitHub API error")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to obtain access token"
                )

            # Get user information
            user_response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }
            )

            user_data = user_response.json()

            # Validate required fields
            if not all(key in user_data for key in ["id", "login"]):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid user data from GitHub"
                )

            # Create response model
            github_user = GitHubUser(
                id=user_data["id"],
                login=user_data["login"],
                name=user_data.get("name"),
                avatar_url=user_data.get("avatar_url"),
                access_token=access_token
            )

            return JSONResponse(
                content=github_user.dict(),
                status_code=status.HTTP_200_OK
            )

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GitHub API unavailable: {str(e)}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Network error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )