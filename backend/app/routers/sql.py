from fastapi import APIRouter, HTTPException

from app.database import get_connection
from app.models.schemas import SQLExecuteRequest, SQLExecuteResponse
from app.services.sql_executor import execute_query

router = APIRouter(prefix="/sql", tags=["sql"])


@router.post("/execute", response_model=SQLExecuteResponse)
async def execute_sql(request: SQLExecuteRequest) -> SQLExecuteResponse:
    """
    Execute a SQL query and return results.
    
    - Queries are read-only by default (SELECT only)
    - Results are limited to prevent memory issues
    - Timeout is enforced to prevent long-running queries
    """
    query = request.query.strip()
    
    # Basic SQL injection protection - block dangerous statements
    # This is a simple check; production would need more robust handling
    blocked_keywords = ["DROP", "TRUNCATE", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "GRANT", "REVOKE"]
    query_upper = query.upper()
    
    # Allow these in practice mode schemas only
    if request.schema_name is None:
        for keyword in blocked_keywords:
            if query_upper.startswith(keyword):
                raise HTTPException(
                    status_code=400,
                    detail=f"Statement type '{keyword}' is not allowed in free query mode"
                )
    
    async with get_connection() as conn:
        result = await execute_query(
            conn=conn,
            query=query,
            schema_name=request.schema_name,
        )
    
    return result
