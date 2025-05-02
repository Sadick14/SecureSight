from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, scans, ai, projects, analysis

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(ai.router)
app.include_router(projects.router)
app.include_router(analysis.router)

