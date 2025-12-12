import asyncio
import time
from typing import Any

import asyncpg

from app.config import get_settings
from app.models.schemas import SQLExecuteResponse

settings = get_settings()


async def execute_query(
    conn: asyncpg.Connection,
    query: str,
    schema_name: str | None = None,
    limit: int | None = None,
    timeout: float | None = None,
) -> SQLExecuteResponse:
    """
    Execute a SQL query and return structured results.
    
    Args:
        conn: Database connection
        query: SQL query to execute
        schema_name: Optional schema to set search_path to
        limit: Maximum rows to return (defaults to settings.max_query_rows)
        timeout: Query timeout in seconds (defaults to settings.max_query_timeout_seconds)
    
    Returns:
        SQLExecuteResponse with results or error
    """
    limit = limit or settings.max_query_rows
    timeout = timeout or settings.max_query_timeout_seconds
    
    start_time = time.perf_counter()
    
    try:
        # Set schema search path if specified
        if schema_name:
            await conn.execute(f"SET search_path TO {schema_name}, public")
        
        # Execute with timeout
        try:
            records = await asyncio.wait_for(
                conn.fetch(query),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            return SQLExecuteResponse(
                success=False,
                error=f"Query timed out after {timeout} seconds"
            )
        
        execution_time = (time.perf_counter() - start_time) * 1000
        
        # Handle empty results
        if not records:
            return SQLExecuteResponse(
                success=True,
                columns=[],
                rows=[],
                row_count=0,
                truncated=False,
                execution_time_ms=execution_time
            )
        
        # Extract column names from first record
        columns = list(records[0].keys())
        
        # Convert records to list of lists, applying limit
        total_rows = len(records)
        truncated = total_rows > limit
        rows = [
            [_serialize_value(record[col]) for col in columns]
            for record in records[:limit]
        ]
        
        return SQLExecuteResponse(
            success=True,
            columns=columns,
            rows=rows,
            row_count=total_rows,
            truncated=truncated,
            execution_time_ms=execution_time
        )
        
    except asyncpg.PostgresError as e:
        execution_time = (time.perf_counter() - start_time) * 1000
        return SQLExecuteResponse(
            success=False,
            error=str(e),
            execution_time_ms=execution_time
        )
    except Exception as e:
        execution_time = (time.perf_counter() - start_time) * 1000
        return SQLExecuteResponse(
            success=False,
            error=f"Unexpected error: {str(e)}",
            execution_time_ms=execution_time
        )


def _serialize_value(value: Any) -> Any:
    """Convert database values to JSON-serializable types."""
    if value is None:
        return None
    if isinstance(value, (int, float, str, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    # Handle dates, times, decimals, etc.
    return str(value)


async def execute_setup_sql(
    conn: asyncpg.Connection,
    setup_sql: str,
    schema_name: str,
) -> tuple[bool, str | None]:
    """
    Execute setup SQL (CREATE TABLE, INSERT) in a specific schema.
    
    Returns:
        Tuple of (success, error_message)
    """
    try:
        # Create schema if it doesn't exist
        await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
        await conn.execute(f"SET search_path TO {schema_name}")
        
        # Execute setup statements
        await conn.execute(setup_sql)
        
        return True, None
    except asyncpg.PostgresError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"
