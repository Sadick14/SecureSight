from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime
import uuid
from enum import Enum


class GitHubUser(BaseModel):
    id: int
    login: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    access_token: str
    email: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CodeContext(BaseModel):
    before: List[str] = Field(default_factory=list)
    after: List[str] = Field(default_factory=list)
    line_number: int

class VulnerabilityDetail(BaseModel):
    test_id: str
    test_name: str
    issue_text: str
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    description: str
    more_info: str
    code: str
    file_path: str
    line_range: List[int]
    context_lines: CodeContext
    ai_explanation: Optional[str] = None
    remediation: Optional[str] = None
    owasp_category: Optional[str] = None
    cwe_category: Optional[str] = None
    priority_score: Optional[float] = Field(None, ge=0, le=10)

class ScanResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scan_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    vulnerabilities: List[VulnerabilityDetail]
    summary: Dict[str, int]  # e.g. {"HIGH": 5, "MEDIUM": 3}
    metadata: Dict[str, Any]
    duration_seconds: float


class FileUploadScanRequest(BaseModel):
    files: List[str]  # Base64 encoded or file paths
    user_id: str
    scan_config: Optional[Dict[str, Any]] = None

class GitHubOAuthResponse(BaseModel):
    access_token: str
    token_type: str
    scope: str
    expires_in: Optional[int] = None
    refresh_token: Optional[str] = None

class ScanHistoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    scan_type: Literal["repository", "file_upload"]
    target: str  # repo URL or file names
    result_count: int
    severity_summary: Dict[str, int]
    duration_seconds: float
    scan_config: Optional[Dict[str, Any]] = None

class APIErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None
    code: int
    request_id: Optional[str] = None

# Enum for scan types
class ScanType(str, Enum):
    TRIVY_VULN = "trivy-vuln"
    TRIVY_CONFIG = "trivy-config"
    TRIVY_SECRETS = "trivy-secrets"
    SNYK_OSS = "snyk-oss"
    SNYK_CODE = "snyk-code"
    SNYK_CONTAINER = "snyk-container"

# Request schema for initiating a scan
class ScanRequest(BaseModel):
    repo: str
    scan_options: List[ScanType]
    user_id: str
    branch: Optional[str] = "main"
    depth: Optional[int] = Field(default=100, ge=1, le=1000)
    created_at: Optional[datetime] = None