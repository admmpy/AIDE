import time
from collections import defaultdict
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.database import get_connection
from app.models.schemas import (
    GenerateQuestionRequest,
    GenerateCustomQuestionRequest,
    GenerateQuestionResponse,
    CheckAnswerRequest,
    CheckAnswerResponse,
    HintResponse,
    Question,
)
from app.services.question_gen import generate_question, generate_custom_question, generate_schema_name
from app.services.sql_executor import execute_query, execute_setup_sql, validate_schema_name

settings = get_settings()
router = APIRouter(prefix="/practice", tags=["practice"])

# In-memory storage for active sessions
# In production, use Redis or a database
_active_sessions: dict[str, dict] = {}

# Rate limiting: track generation requests per session
_rate_limits: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(session_id: str) -> bool:
    """Check if session has exceeded rate limit."""
    now = time.time()
    window_start = now - 60  # 1 minute window
    
    # Clean old entries
    _rate_limits[session_id] = [
        t for t in _rate_limits[session_id] if t > window_start
    ]
    
    if len(_rate_limits[session_id]) >= settings.rate_limit_per_minute:
        return False
    
    _rate_limits[session_id].append(now)
    return True


@router.post("/generate", response_model=GenerateQuestionResponse)
async def generate_practice_question(
    request: GenerateQuestionRequest,
) -> GenerateQuestionResponse:
    """
    Generate a new practice question with dataset.
    
    Creates an isolated schema, sets up tables, and returns the question.
    Rate limited to prevent LLM overload.
    """
    # Generate or use existing session ID
    session_id = str(uuid4())
    
    # Check rate limit
    if not _check_rate_limit(session_id):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {settings.rate_limit_per_minute} questions per minute.",
        )
    
    try:
        # Generate question using LLM
        question = await generate_question(
            difficulty=request.difficulty,
            domain=request.domain,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to generate question. Is Ollama running? Error: {str(e)}",
        )
    
    # Create isolated schema and set up tables
    schema_name = generate_schema_name()
    
    async with get_connection() as conn:
        success, error = await execute_setup_sql(
            conn=conn,
            setup_sql=question.setup_sql,
            schema_name=schema_name,
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to set up practice database: {error}",
            )
    
    # Store session data
    _active_sessions[session_id] = {
        "schema_name": schema_name,
        "question": question,
        "hints_revealed": 0,
        "created_at": time.time(),
    }
    
    return GenerateQuestionResponse(
        question=question,
        schema_name=schema_name,
        session_id=session_id,
    )


@router.post("/generate-custom", response_model=GenerateQuestionResponse)
async def generate_custom_practice_question(
    request: GenerateCustomQuestionRequest,
) -> GenerateQuestionResponse:
    session_id = str(uuid4())

    if not _check_rate_limit(session_id):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {settings.rate_limit_per_minute} questions per minute.",
        )

    try:
        question = await generate_custom_question(user_prompt=request.user_prompt)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to generate question. Is Ollama running? Error: {str(e)}",
        )

    schema_name = generate_schema_name()

    async with get_connection() as conn:
        success, error = await execute_setup_sql(
            conn=conn,
            setup_sql=question.setup_sql,
            schema_name=schema_name,
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to set up practice database: {error}",
            )

    _active_sessions[session_id] = {
        "schema_name": schema_name,
        "question": question,
        "hints_revealed": 0,
        "created_at": time.time(),
    }

    return GenerateQuestionResponse(
        question=question,
        schema_name=schema_name,
        session_id=session_id,
    )


@router.post("/check", response_model=CheckAnswerResponse)
async def check_answer(request: CheckAnswerRequest) -> CheckAnswerResponse:
    """
    Check if the user's query produces the correct results.
    
    Compares user query output against the expected query output.
    """
    # Validate schema name format to prevent SQL injection
    if not validate_schema_name(request.schema_name):
        raise HTTPException(status_code=400, detail="Invalid schema name format")
    
    session = _active_sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["schema_name"] != request.schema_name:
        raise HTTPException(status_code=400, detail="Schema mismatch")
    
    question: Question = session["question"]
    
    async with get_connection() as conn:
        # Execute user's query
        user_result = await execute_query(
            conn=conn,
            query=request.query,
            schema_name=request.schema_name,
        )
        
        if not user_result.success:
            return CheckAnswerResponse(
                correct=False,
                error=user_result.error,
            )
        
        # Execute expected query
        expected_result = await execute_query(
            conn=conn,
            query=question.expected_query,
            schema_name=request.schema_name,
        )
        
        if not expected_result.success:
            # This shouldn't happen if question was validated
            return CheckAnswerResponse(
                correct=False,
                error=f"Internal error: expected query failed - {expected_result.error}",
            )
    
    # Compare results
    # Normalize for comparison (convert to sorted tuples for order-independent comparison)
    def normalize_rows(rows: list, columns: list) -> set:
        return set(tuple(str(v) for v in row) for row in rows)
    
    user_set = normalize_rows(user_result.rows, user_result.columns)
    expected_set = normalize_rows(expected_result.rows, expected_result.columns)
    
    # Check column names match (case-insensitive)
    user_cols_lower = [c.lower() for c in user_result.columns]
    expected_cols_lower = [c.lower() for c in expected_result.columns]
    
    columns_match = user_cols_lower == expected_cols_lower
    rows_match = user_set == expected_set
    
    correct = columns_match and rows_match
    row_diff = len(user_set.symmetric_difference(expected_set))
    
    return CheckAnswerResponse(
        correct=correct,
        user_columns=user_result.columns,
        user_rows=user_result.rows,
        expected_columns=expected_result.columns,
        expected_rows=expected_result.rows,
        row_diff=row_diff,
    )


@router.get("/hint/{session_id}", response_model=HintResponse)
async def get_hint(session_id: str) -> HintResponse:
    """
    Get hints for the current question.
    
    Reveals hints progressively - each call reveals one more hint.
    """
    session = _active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    question: Question = session["question"]
    all_hints = question.hints
    
    # Reveal one more hint
    revealed = min(session["hints_revealed"] + 1, len(all_hints))
    session["hints_revealed"] = revealed
    
    return HintResponse(
        hints=all_hints[:revealed],
        revealed_count=revealed,
    )


@router.delete("/session/{session_id}")
async def cleanup_session(session_id: str) -> dict:
    """
    Clean up a practice session and its schema.
    """
    session = _active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    schema_name = session["schema_name"]
    
    # Validate schema name before using in SQL (defense in depth)
    if not validate_schema_name(schema_name):
        raise HTTPException(status_code=400, detail="Invalid schema name format")
    
    async with get_connection() as conn:
        try:
            await conn.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE")
        except Exception:
            # Log but don't fail - schema might already be cleaned
            pass
    
    del _active_sessions[session_id]
    
    return {"status": "cleaned", "schema_name": schema_name}
