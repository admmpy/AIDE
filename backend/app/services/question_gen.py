import json
import random
import re
from uuid import uuid4

from app.config import get_settings
from app.models.schemas import Question, Difficulty, TableSchema
from app.services.llm import llm_client, extract_json

settings = get_settings()

# Available domains for question generation
DOMAINS = [
    "e-commerce",
    "HR/employees",
    "social media",
    "healthcare",
    "finance",
    "logistics",
]

# System prompt for consistent JSON output
SYSTEM_PROMPT = """You are a SQL question generator for PostgreSQL 14.
Output ONLY valid JSON. No markdown, no explanations."""

# Few-shot examples by difficulty
FEW_SHOTS = {
    "easy": """{
  "title": "High-Value Orders",
  "description": "Find all orders with amount > 500, sorted by amount desc.",
  "tables": [{
    "name": "orders",
    "columns": ["order_id SERIAL PRIMARY KEY", "customer_id INT", "amount DECIMAL(10,2)"],
    "sample_data": [[1, 101, 750.50], [2, 102, 125.00]]
  }],
  "setup_sql": "CREATE TABLE orders (order_id SERIAL PRIMARY KEY, customer_id INT, amount DECIMAL(10,2)); INSERT INTO orders (customer_id, amount) VALUES (101, 750.50), (102, 125.00);",
  "expected_query": "SELECT * FROM orders WHERE amount > 500 ORDER BY amount DESC;",
  "expected_columns": ["order_id", "customer_id", "amount"],
  "hints": ["Use WHERE amount > 500", "Use ORDER BY amount DESC"]
}""",

    "medium": """{
  "title": "Customer Order Totals",
  "description": "Find customers who spent > 1000 total. Show name and total_spent, sorted desc.",
  "tables": [
    {"name": "customers", "columns": ["id SERIAL PRIMARY KEY", "name VARCHAR"], "sample_data": [[1, "Alice"], [2, "Bob"]]},
    {"name": "orders", "columns": ["id SERIAL PRIMARY KEY", "cust_id INT", "amt DECIMAL"], "sample_data": [[1, 1, 500], [2, 1, 750]]}
  ],
  "setup_sql": "CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR); CREATE TABLE orders (id SERIAL PRIMARY KEY, cust_id INT, amt DECIMAL); INSERT INTO customers (name) VALUES ('Alice'), ('Bob'); INSERT INTO orders (cust_id, amt) VALUES (1, 500), (1, 750);",
  "expected_query": "SELECT c.name, SUM(o.amt) AS total_spent FROM customers c JOIN orders o ON c.id = o.cust_id GROUP BY c.id, c.name HAVING SUM(o.amt) > 1000 ORDER BY total_spent DESC;",
  "expected_columns": ["name", "total_spent"],
  "hints": ["JOIN customers and orders", "GROUP BY customer", "HAVING SUM(amt) > 1000"]
}""",

    "hard": """{
  "title": "Monthly Revenue Growth",
  "description": "Show month, revenue, and running total revenue. Order by month.",
  "tables": [
    {"name": "orders", "columns": ["id SERIAL PRIMARY KEY", "amt DECIMAL", "dt DATE"], "sample_data": [[1, 500, "2024-01-15"], [2, 750, "2024-02-20"]]}
  ],
  "setup_sql": "CREATE TABLE orders (id SERIAL PRIMARY KEY, amt DECIMAL, dt DATE); INSERT INTO orders (amt, dt) VALUES (500, '2024-01-15'), (750, '2024-02-20');",
  "expected_query": "WITH m AS (SELECT DATE_TRUNC('month', dt) as mon, SUM(amt) as rev FROM orders GROUP BY 1) SELECT mon, rev, SUM(rev) OVER (ORDER BY mon) as run_tot FROM m ORDER BY mon;",
  "expected_columns": ["mon", "rev", "run_tot"],
  "hints": ["Group by month first", "Use window function SUM() OVER()"]
}"""
}

# Difficulty guide for prompts
DIFFICULTY_GUIDE = {
    "easy": "Single table, basic SELECT/WHERE/ORDER BY",
    "medium": "2-3 tables, JOINs, GROUP BY + HAVING",
    "hard": "3-5 tables, Window functions, CTEs",
}


def build_prompt(difficulty: str, domain: str) -> str:
    """Build the question generation prompt."""
    max_tables = {"easy": 1, "medium": 3, "hard": 5}.get(difficulty, 3)
    
    return f"""Generate a SQL practice question.

DIFFICULTY: {difficulty} ({DIFFICULTY_GUIDE.get(difficulty)})
DOMAIN: {domain}

OUTPUT FORMAT (JSON only):
{{
  "title": "Title",
  "description": "Problem statement.",
  "tables": [{{"name": "t1", "columns": ["id SERIAL", "c1 TYPE"], "sample_data": [[1, "v"]]}}],
  "setup_sql": "CREATE TABLE ...; INSERT INTO ...;",
  "expected_query": "SELECT ...",
  "expected_columns": ["c1"],
  "hints": ["hint1", "hint2"]
}}

CONSTRAINTS:
- Max {max_tables} tables, {settings.max_practice_rows} total rows
- Realistic data, no placeholders
- Valid PostgreSQL 14 syntax

EXAMPLE ({difficulty}):
{FEW_SHOTS.get(difficulty, FEW_SHOTS["medium"])}"""


async def generate_question(
    difficulty: Difficulty,
    domain: str | None = None,
    max_retries: int = 2,
) -> Question:
    """
    Generate a practice question using the LLM.
    
    Args:
        difficulty: Question difficulty level
        domain: Optional domain (random if not specified)
        max_retries: Number of retries on failure
    
    Returns:
        Generated Question object
    
    Raises:
        ValueError: If generation fails after all retries
    """
    domain = domain or random.choice(DOMAINS)
    prompt = build_prompt(difficulty.value, domain)
    
    last_error: str | None = None
    
    for attempt in range(max_retries + 1):
        try:
            # Add error context for retries
            if attempt > 0 and last_error:
                retry_prompt = f"""The previous attempt had an error: {last_error}

Please fix the issue and regenerate. Remember:
- Output ONLY valid JSON
- Ensure all SQL statements are valid PostgreSQL 14
- Make sure expected_query actually works with the setup_sql schema

{prompt}"""
                raw_response = await llm_client.generate(
                    prompt=retry_prompt,
                    system=SYSTEM_PROMPT,
                    temperature=0.7,
                )
            else:
                raw_response = await llm_client.generate(
                    prompt=prompt,
                    system=SYSTEM_PROMPT,
                    temperature=0.7,
                )
            
            # Extract and parse JSON
            json_str = extract_json(raw_response)
            data = json.loads(json_str)
            
            # Validate required fields
            required_fields = ["title", "description", "tables", "setup_sql", "expected_query", "expected_columns", "hints"]
            missing = [f for f in required_fields if f not in data]
            if missing:
                raise ValueError(f"Missing required fields: {missing}")
            
            # Parse tables
            tables = [
                TableSchema(
                    name=t["name"],
                    columns=t["columns"],
                    sample_data=t["sample_data"],
                )
                for t in data["tables"]
            ]
            
            return Question(
                title=data["title"],
                description=data["description"],
                tables=tables,
                setup_sql=data["setup_sql"],
                expected_query=data["expected_query"],
                expected_columns=data["expected_columns"],
                hints=data["hints"],
            )
            
        except json.JSONDecodeError as e:
            last_error = f"Invalid JSON: {str(e)}"
        except KeyError as e:
            last_error = f"Missing field: {str(e)}"
        except Exception as e:
            last_error = str(e)
    
    raise ValueError(f"Failed to generate question after {max_retries + 1} attempts. Last error: {last_error}")


def generate_schema_name() -> str:
    """Generate a unique schema name for practice sessions."""
    return f"practice_{uuid4().hex[:8]}"
