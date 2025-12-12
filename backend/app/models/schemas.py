from pydantic import BaseModel, Field
from typing import Any
from enum import Enum


# ─────────────────────────────────────────────────────────────────────────────
# SQL Execution
# ─────────────────────────────────────────────────────────────────────────────

class SQLExecuteRequest(BaseModel):
    """Request to execute a SQL query."""
    query: str = Field(..., min_length=1, max_length=10000)
    schema_name: str | None = Field(default=None, description="Optional schema to execute in")


class SQLExecuteResponse(BaseModel):
    """Response from SQL query execution."""
    success: bool
    columns: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    row_count: int = 0
    truncated: bool = False
    error: str | None = None
    execution_time_ms: float = 0


# ─────────────────────────────────────────────────────────────────────────────
# Practice Mode
# ─────────────────────────────────────────────────────────────────────────────

class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TableSchema(BaseModel):
    """Schema information for a single table."""
    name: str
    columns: list[str]
    sample_data: list[list[Any]]


class Question(BaseModel):
    """A generated practice question."""
    title: str
    description: str
    tables: list[TableSchema]
    setup_sql: str
    expected_query: str
    expected_columns: list[str]
    hints: list[str]


class GenerateQuestionRequest(BaseModel):
    """Request to generate a new practice question."""
    difficulty: Difficulty = Difficulty.EASY
    domain: str | None = Field(default=None, description="Optional domain (e-commerce, HR, etc.)")


class GenerateCustomQuestionRequest(BaseModel):
    """Request to generate a custom practice question from natural language."""
    user_prompt: str = Field(..., min_length=10, max_length=500)


class GenerateQuestionResponse(BaseModel):
    """Response containing the generated question and session info."""
    question: Question
    schema_name: str
    session_id: str


class CheckAnswerRequest(BaseModel):
    """Request to check a user's answer."""
    query: str = Field(..., min_length=1, max_length=10000)
    schema_name: str
    session_id: str


class CheckAnswerResponse(BaseModel):
    """Response from answer checking."""
    correct: bool
    user_columns: list[str] = Field(default_factory=list)
    user_rows: list[list[Any]] = Field(default_factory=list)
    expected_columns: list[str] = Field(default_factory=list)
    expected_rows: list[list[Any]] = Field(default_factory=list)
    row_diff: int = 0
    error: str | None = None


class HintResponse(BaseModel):
    """Response containing hints for the current question."""
    hints: list[str]
    revealed_count: int
