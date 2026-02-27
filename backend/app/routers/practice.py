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
    ModelOption,
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

MODEL_METADATA: dict[str, tuple[str, str]] = {
    "openai/gpt-4o-mini": ("GPT-4o Mini", "Fast and affordable"),
    "openai/gpt-4o": ("GPT-4o", "Most capable OpenAI model"),
    "anthropic/claude-3.5-sonnet": ("Claude 3.5 Sonnet", "Strong for reasoning and SQL tasks"),
    "meta-llama/llama-3.1-8b-instruct:free": ("Llama 3.1 8B (Free)", "Free-tier model"),
    "google/gemini-flash-1.5": ("Gemini Flash 1.5", "Fast and cost-effective"),
    "deepseek/deepseek-chat": ("DeepSeek Chat", "Cost-effective general model"),
}

SYNTAX_CODES = {"42601"}
MISSING_RELATION_OR_COLUMN_CODES = {"42P01", "42703"}
TYPE_OR_FUNCTION_CODES = {"42883", "42804", "22P02"}
RUNTIME_CODES = {"57014", "22012", "53200", "53300", "53400"}


def _classify_sql_failure(error: str | None, error_code: str | None) -> tuple[str, str]:
    """Map SQL execution errors to learner-facing categories."""
    code = (error_code or "").upper()
    message = (error or "").strip() or "Query execution failed."
    lowered = message.lower()

    if code in SYNTAX_CODES or "syntax error" in lowered:
        return "syntax", "Syntax error: check query structure, commas, and clause order."

    if code in MISSING_RELATION_OR_COLUMN_CODES or "does not exist" in lowered:
        return "missing_relation_or_column", "Missing table/column: verify names and schema references."

    if code in TYPE_OR_FUNCTION_CODES or "operator does not exist" in lowered or "function" in lowered:
        return "type_or_function", "Type/function mismatch: verify casts, operators, and function signatures."

    if code in RUNTIME_CODES or "timed out" in lowered:
        return "runtime", "Runtime error: query execution failed due to timeout or runtime constraints."

    return "runtime", "Execution error: review the SQL error details and retry."


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


def _validate_or_default_model(model_id: str | None) -> str | None:
    if not model_id:
        return None
    if model_id not in settings.allowed_models_list():
        raise HTTPException(status_code=400, detail=f"Model '{model_id}' is not allowed")
    return model_id


@router.get("/models", response_model=list[ModelOption])
async def get_models() -> list[ModelOption]:
    allowed = settings.allowed_models_list()
    default_id = settings.openrouter_default_model
    result: list[ModelOption] = []
    for model_id in allowed:
        name, description = MODEL_METADATA.get(model_id, (model_id, "Allowed model"))
        result.append(
            ModelOption(
                id=model_id,
                name=name,
                description=description,
                is_default=model_id == default_id,
            )
        )
    return result


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
        model_id = _validate_or_default_model(request.model_id)
        # Generate question using LLM
        question = await generate_question(
            difficulty=request.difficulty,
            domain=request.domain,
            model_id=model_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to generate question via OpenRouter. Error: {str(e)}",
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
        model_id = _validate_or_default_model(request.model_id)
        question = await generate_custom_question(
            user_prompt=request.user_prompt,
            model_id=model_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to generate question via OpenRouter. Error: {str(e)}",
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
            failure_type, failure_message = _classify_sql_failure(
                user_result.error, user_result.error_code
            )
            return CheckAnswerResponse(
                correct=False,
                error=user_result.error,
                failure_type=failure_type,
                failure_message=failure_message,
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
                failure_type="runtime",
                failure_message="Internal validation error: expected query failed.",
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
    failure_type = "none"
    failure_message = None
    if not correct:
        if not columns_match and not rows_match:
            failure_type = "wrong_columns_and_rows"
            failure_message = "Columns and rows do not match the expected output."
        elif not columns_match:
            failure_type = "wrong_columns"
            failure_message = "Column names/order do not match expected output."
        else:
            failure_type = "wrong_rows"
            failure_message = "Rows do not match expected output."
    
    return CheckAnswerResponse(
        correct=correct,
        user_columns=user_result.columns,
        user_rows=user_result.rows,
        expected_columns=expected_result.columns,
        expected_rows=expected_result.rows,
        row_diff=row_diff,
        failure_type=failure_type,
        failure_message=failure_message,
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
