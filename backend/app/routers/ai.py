# app/routers/ai.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
import os
import uuid
from datetime import datetime
from pathlib import Path
import tempfile
from app.dependencies import get_current_user
from app.models.schemas import GitHubUser
import google.generativeai as genai
from supabase import create_client, Client
import logging
from enum import Enum
import time

router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize services
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Rate limiting variables
GEMINI_LAST_CALL_TIME = 0
GEMINI_RATE_LIMIT_DELAY = 60  # 60 seconds between calls

# ====================== MODELS ======================
class MessageSender(str, Enum):
    USER = "user"
    AI = "ai"
    SYSTEM = "system"

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    sender: MessageSender
    timestamp: datetime = Field(default_factory=datetime.now)
    references: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class AnalysisContext(BaseModel):
    repo_name: Optional[str] = None
    scan_results: Optional[Dict[str, Any]] = None
    file_names: Optional[List[str]] = None
    code_snippets: Optional[Dict[str, str]] = None
    vulnerability_details: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    message: str
    context: AnalysisContext
    conversation_id: Optional[str] = None
    message_history: Optional[List[ChatMessage]] = None

class FileAnalysisRequest(BaseModel):
    files: List[UploadFile]
    repo_name: Optional[str] = None
    user_id: str
    conversation_id: Optional[str] = None

class ConversationInDB(BaseModel):
    id: str
    user_id: str
    github_login: str
    repo_name: Optional[str]
    scan_id: Optional[str]
    title: str
    messages: List[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: datetime

# ====================== FILE ANALYSIS HELPERS ======================
def detect_language(filename: str) -> str:
    """Detect programming language based on file extension."""
    extension = filename.split('.')[-1].lower()
    language_map = {
        'py': 'python',
        'js': 'javascript',
        'ts': 'typescript',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'php': 'php',
        'sh': 'bash',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'yaml': 'yaml',
        'yml': 'yaml',
        'toml': 'toml'
    }
    return language_map.get(extension, 'unknown')

def detect_basic_vulnerabilities(content: str, language: str) -> List[Dict[str, Any]]:
    """Detect basic security vulnerabilities in code."""
    vulnerabilities = []
    content_lower = content.lower()
    
    # Language-agnostic checks
    if any(cred in content_lower for cred in ['password', 'secret', 'api_key', 'token']):
        if '=' in content_lower or ':' in content_lower:
            vulnerabilities.append({
                "type": "hardcoded_credential",
                "severity": "high",
                "description": "Potential hardcoded credential found"
            })
    
    if 'eval(' in content_lower:
        vulnerabilities.append({
            "type": "dangerous_eval",
            "severity": "high",
            "description": "eval() function detected which can be dangerous"
        })

    # Language-specific checks
    if language == "python":
        if any(cmd in content_lower for cmd in ['subprocess.call', 'os.system', 'os.popen']):
            vulnerabilities.append({
                "type": "shell_injection",
                "severity": "high",
                "description": "Potential shell injection vulnerability"
            })
    
    elif language == "javascript":
        if 'innerhtml' in content_lower and ('<' in content or '>' in content):
            vulnerabilities.append({
                "type": "xss",
                "severity": "high",
                "description": "Potential XSS vulnerability"
            })
    
    return vulnerabilities

def estimate_complexity(content: str, language: str) -> int:
    """Estimate code complexity based on simple heuristics."""
    lines = content.split('\n')
    complexity = 0
    
    # Basic complexity estimation
    complexity += sum(1 for line in lines if any(kw in line for kw in ['if ', 'for ', 'while ', 'switch ', 'case ']))
    complexity += sum(1 for line in lines if 'def ' in line or 'function ' in line or 'class ' in line)
    
    # Language-specific adjustments
    if language == "python":
        complexity += sum(1 for line in lines if 'import ' in line) * 0.5
    elif language == "javascript":
        complexity += sum(1 for line in lines if 'require(' in line) * 0.5
    
    return max(1, int(complexity))

def analyze_file_security(file_path: Path) -> Dict[str, Any]:
    """Analyze a file for security issues and code metrics."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        language = detect_language(file_path.name)
        
        return {
            "language": language,
            "vulnerabilities": detect_basic_vulnerabilities(content, language),
            "metrics": {
                "lines": len(content.split('\n')),
                "size_kb": os.path.getsize(file_path) / 1024,
                "complexity": estimate_complexity(content, language)
            }
        }
    except Exception as e:
        logger.error(f"Error analyzing file {file_path}: {str(e)}")
        return {
            "language": "unknown",
            "vulnerabilities": [],
            "metrics": {},
            "error": str(e)
        }

def generate_analysis_summary(analysis_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate a summary of file analysis results."""
    summary = {
        "total_files": len(analysis_results),
        "languages": set(),
        "vulnerability_counts": {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0
        },
        "metrics": {
            "total_lines": 0,
            "total_size_kb": 0,
            "avg_complexity": 0
        }
    }
    
    total_complexity = 0
    
    for result in analysis_results:
        if "analysis" not in result:
            continue
            
        analysis = result["analysis"]
        summary["languages"].add(analysis.get("language", "unknown"))
        
        # Count vulnerabilities
        for vuln in analysis.get("vulnerabilities", []):
            severity = vuln.get("severity", "low").lower()
            if severity in summary["vulnerability_counts"]:
                summary["vulnerability_counts"][severity] += 1
        
        # Sum metrics
        metrics = analysis.get("metrics", {})
        summary["metrics"]["total_lines"] += metrics.get("lines", 0)
        summary["metrics"]["total_size_kb"] += metrics.get("size_kb", 0)
        total_complexity += metrics.get("complexity", 0)
    
    # Calculate averages
    if summary["total_files"] > 0:
        summary["metrics"]["avg_complexity"] = total_complexity / summary["total_files"]
    
    # Convert set to list
    summary["languages"] = list(summary["languages"])
    
    return summary

# ====================== HELPER FUNCTIONS ======================
async def create_conversation(
    user_id: str,
    github_login: str,
    initial_message: str,
    repo_name: Optional[str] = None,
    scan_id: Optional[str] = None
) -> ConversationInDB:
    """Create a new conversation in the database."""
    try:
        conversation_data = {
            "user_id": user_id,
            "github_login": github_login,
            "repo_name": repo_name,
            "scan_id": scan_id,
            "title": initial_message[:50] + ("..." if len(initial_message) > 50 else ""),
            "messages": [],
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase.table("conversations").insert(conversation_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        
        return ConversationInDB(**response.data[0])
    except Exception as e:
        logger.error(f"Failed to create conversation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create new conversation"
        )

async def update_conversation_messages(
    conversation_id: str,
    messages: List[Dict[str, Any]]
) -> bool:
    """Update conversation messages in the database with proper datetime handling."""
    try:
        # Convert all datetime objects to ISO format strings
        serializable_messages = []
        for msg in messages:
            serialized_msg = msg.copy()
            if 'timestamp' in serialized_msg:
                if hasattr(serialized_msg['timestamp'], 'isoformat'):
                    serialized_msg['timestamp'] = serialized_msg['timestamp'].isoformat()
                elif isinstance(serialized_msg['timestamp'], str):
                    try:
                        # Ensure the string is in proper ISO format
                        datetime.fromisoformat(serialized_msg['timestamp'])
                    except ValueError:
                        serialized_msg['timestamp'] = datetime.now().isoformat()
            serializable_messages.append(serialized_msg)
        
        response = supabase.table("conversations").update({
            "messages": serializable_messages,
            "updated_at": datetime.now().isoformat()
        }).eq("id", conversation_id).execute()
        
        return response.data is not None
    except Exception as e:
        logger.error(f"Failed to update conversation: {str(e)}")
        return False

async def get_conversation(
    conversation_id: str, 
    user_id: str
) -> Optional[ConversationInDB]:
    """Get a conversation from the database."""
    try:
        response = supabase.table("conversations") \
            .select("*") \
            .eq("id", conversation_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()
        
        return ConversationInDB(**response.data)
    except Exception as e:
        logger.error(f"Failed to fetch conversation: {str(e)}")
        return None

async def get_user_conversations(
    user_id: str, 
    limit: int = 20
) -> List[ConversationInDB]:
    """Get all conversations for a user."""
    try:
        response = supabase.table("conversations") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("updated_at", desc=True) \
            .limit(limit) \
            .execute()
        
        return [ConversationInDB(**conv) for conv in response.data]
    except Exception as e:
        logger.error(f"Failed to fetch conversations: {str(e)}")
        return []

# ====================== AI HELPER FUNCTIONS ======================
def analyze_with_gemini(
    message: str, 
    context: AnalysisContext, 
    history: Optional[List[ChatMessage]] = None
) -> Union[str, Dict[str, Any]]:
    """Get response from Gemini AI model with comprehensive error handling."""
    global GEMINI_LAST_CALL_TIME
    
    try:
        # Check API key
        if not genai._client._client_config.api_key:
            logger.error("Gemini API key not configured")
            return {
                "content": "AI service is not properly configured. Please contact support.",
                "suggestions": ["Check backend configuration"]
            }

        # Rate limiting
        current_time = time.time()
        if current_time - GEMINI_LAST_CALL_TIME < GEMINI_RATE_LIMIT_DELAY:
            wait_time = GEMINI_RATE_LIMIT_DELAY - (current_time - GEMINI_LAST_CALL_TIME)
            time.sleep(wait_time)

        # Initialize model
        model = genai.GenerativeModel('gemini-pro')
        
        # Build prompt
        prompt_parts = [
            "You are SecureSight AI, a security analysis assistant.",
            f"Analyze this security question: {message}",
            f"Context: Repository: {context.repo_name or 'Not specified'}",
            f"Files: {', '.join(context.file_names) if context.file_names else 'None'}"
        ]
        
        if history:
            prompt_parts.append("\nPrevious messages:")
            for msg in history[-5:]:  # Last 5 messages for context
                prompt_parts.append(f"{msg.sender}: {msg.content}")

        # Make API call
        GEMINI_LAST_CALL_TIME = time.time()
        response = model.generate_content("\n".join(prompt_parts))
        
        if not response.text:
            logger.error("Empty response from Gemini API")
            return {
                "content": "Received an empty response from the AI service.",
                "suggestions": ["Try rephrasing your question", "Try again later"]
            }
            
        return response.text
        
    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}", exc_info=True)
        
        # Specific error messages for common cases
        if "429" in str(e):
            return {
                "content": "The AI service is currently busy. Please wait a moment and try again.",
                "suggestions": ["Wait 1 minute before trying again"]
            }
        elif "503" in str(e) or "500" in str(e):
            return {
                "content": "The AI service is temporarily unavailable.",
                "suggestions": ["Try again in a few minutes"]
            }
        
        return {
            "content": "I encountered an error processing your request. Please try again later.",
            "suggestions": ["Check your internet connection", "Try a different question"]
        }

def extract_vulnerability_suggestions(ai_response: Union[str, Dict[str, Any]]) -> List[str]:
    """Extract vulnerability suggestions from AI response."""
    if isinstance(ai_response, dict):
        return ai_response.get("suggestions", ["No specific suggestions available"])
    
    suggestions = []
    if "vulnerability" in ai_response.lower():
        suggestions.append("Review potential vulnerabilities mentioned above")
    if "recommend" in ai_response.lower():
        suggestions.append("Consider the recommendations provided")
    return suggestions if suggestions else ["No specific suggestions available"]

# ====================== API ENDPOINTS ======================
@router.post("/chat", response_model=ChatMessage)
async def chat_with_ai(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    user: GitHubUser = Depends(get_current_user)
):
    """Handle chat messages with comprehensive error handling."""
    try:
        # Validate input
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # Get or create conversation
        conversation = None
        if request.conversation_id:
            conversation = await get_conversation(request.conversation_id, user.id)
            if not conversation:
                logger.warning(f"Conversation {request.conversation_id} not found, creating new one")
        
        if not conversation:
            try:
                conversation = await create_conversation(
                    user.id,
                    user.login,
                    request.message,
                    request.context.repo_name,
                    request.context.scan_results.get("_summary", {}).get("scan_id") if request.context.scan_results else None
                )
            except Exception as e:
                logger.error(f"Failed to create conversation: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create conversation"
                )

        # Create user message
        user_message = {
            "id": str(uuid.uuid4()),
            "content": request.message,
            "sender": "user",
            "timestamp": datetime.now().isoformat(),
            "references": {
                "repo": request.context.repo_name,
                "files": request.context.file_names
            }
        }

        # Get AI response with retry logic
        max_retries = 2
        ai_response = None
        
        for attempt in range(max_retries):
            try:
                ai_response = analyze_with_gemini(
                    request.message,
                    request.context,
                    request.message_history
                )
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Final attempt failed for Gemini API: {str(e)}")
                    ai_response = {
                        "content": "Sorry, I'm having trouble responding right now.",
                        "suggestions": ["Please try again later"]
                    }
                else:
                    wait_time = 1 * (attempt + 1)
                    time.sleep(wait_time)

        # Handle response format
        if isinstance(ai_response, str):
            content = ai_response
            suggestions = extract_vulnerability_suggestions(content)
        else:
            content = ai_response.get("content", "No response generated")
            suggestions = ai_response.get("suggestions", [])

        # Create AI message
        ai_message = {
            "id": str(uuid.uuid4()),
            "content": content,
            "sender": "ai",
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "analysis_context": request.context.dict(),
                "suggestions": suggestions
            }
        }

        # Prepare messages for update
        messages_to_save = [user_message, ai_message]
        if request.message_history:
            messages_to_save = [
                {**msg.dict(), "timestamp": msg.timestamp.isoformat()}
                for msg in request.message_history
            ] + messages_to_save
            
        # Update conversation in background
        background_tasks.add_task(
            update_conversation_messages,
            conversation.id,
            messages_to_save
        )

        return ChatMessage(**ai_message)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected chat error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during chat processing"
        )

@router.get("/conversations", response_model=List[ConversationInDB])
async def get_conversations(
    repo_name: Optional[str] = None,
    scan_id: Optional[str] = None,
    user: GitHubUser = Depends(get_current_user)
):
    """Get all conversations for the current user."""
    try:
        conversations = await get_user_conversations(user.id)
        
        # Apply filters if provided
        if repo_name:
            conversations = [c for c in conversations if c.repo_name == repo_name]
        if scan_id:
            conversations = [c for c in conversations if c.scan_id == scan_id]
            
        return conversations
    except Exception as e:
        logger.error(f"Failed to fetch conversations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve conversations"
        )

@router.post("/analyze-files")
async def analyze_files(
    files: List[UploadFile] = File(...),
    repo_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
    user: GitHubUser = Depends(get_current_user)
):
    """Analyze uploaded files for security vulnerabilities."""
    try:
        # Validate files
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 files can be analyzed at once")

        with tempfile.TemporaryDirectory() as temp_dir:
            analysis_results = []
            
            for file in files:
                try:
                    # Validate file size (5MB max)
                    if file.size > 5 * 1024 * 1024:
                        logger.warning(f"File {file.filename} exceeds size limit")
                        analysis_results.append({
                            "filename": file.filename,
                            "error": "File exceeds size limit (5MB)"
                        })
                        continue

                    file_path = Path(temp_dir) / file.filename
                    
                    # Save file content
                    with open(file_path, "wb") as buffer:
                        content = await file.read()
                        buffer.write(content)
                    
                    # Analyze file
                    file_stats = analyze_file_security(file_path)
                    
                    # Store analysis in Supabase
                    analysis_data = {
                        "user_id": user.id,
                        "conversation_id": conversation_id,
                        "file_name": file.filename,
                        "analysis_results": file_stats,
                        "created_at": datetime.now().isoformat()
                    }
                    
                    response = supabase.table("file_analysis").insert(analysis_data).execute()
                    if not response.data:
                        logger.error(f"Failed to save analysis for {file.filename}")
                    
                    analysis_results.append({
                        "filename": file.filename,
                        "analysis": file_stats
                    })
                except Exception as e:
                    logger.error(f"Error analyzing {file.filename}: {str(e)}", exc_info=True)
                    analysis_results.append({
                        "filename": file.filename,
                        "error": str(e)
                    })
                    continue
            
            # Generate summary
            summary = generate_analysis_summary(analysis_results)
            
            return {
                "repo": repo_name,
                "analysis_id": str(uuid.uuid4()),
                "results": analysis_results,
                "summary": summary
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File analysis error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="File analysis failed. Please check the logs for details."
        )