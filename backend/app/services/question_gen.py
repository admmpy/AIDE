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
Output ONLY valid JSON matching the exact schema provided.
No explanations, no markdown formatting outside the JSON, no extra text.
Ensure all SQL is valid PostgreSQL 14 syntax."""

# Few-shot examples by difficulty
FEW_SHOTS = {
    "easy": """{
  "title": "High-Value Orders",
  "description": "Find all orders with a total amount greater than 500, sorted by amount descending.",
  "tables": [{
    "name": "orders",
    "columns": ["order_id SERIAL PRIMARY KEY", "customer_id INT", "amount DECIMAL(10,2)", "created_at DATE"],
    "sample_data": [[1, 101, 250.00, "2024-01-15"], [2, 102, 750.50, "2024-01-16"], [3, 101, 125.00, "2024-01-17"], [4, 103, 890.00, "2024-01-18"], [5, 102, 50.00, "2024-01-19"]]
  }],
  "setup_sql": "CREATE TABLE orders (order_id SERIAL PRIMARY KEY, customer_id INT, amount DECIMAL(10,2), created_at DATE); INSERT INTO orders (customer_id, amount, created_at) VALUES (101, 250.00, '2024-01-15'), (102, 750.50, '2024-01-16'), (101, 125.00, '2024-01-17'), (103, 890.00, '2024-01-18'), (102, 50.00, '2024-01-19');",
  "expected_query": "SELECT * FROM orders WHERE amount > 500 ORDER BY amount DESC;",
  "expected_columns": ["order_id", "customer_id", "amount", "created_at"],
  "hints": ["Filter rows based on a numeric condition", "Use WHERE with a comparison operator"]
}""",

    "medium": """{
  "title": "Customer Order Totals",
  "description": "Find each customer's name and their total order amount. Only include customers who have spent more than 1000 in total. Sort by total spent descending.",
  "tables": [
    {"name": "customers", "columns": ["customer_id SERIAL PRIMARY KEY", "name VARCHAR(100)", "email VARCHAR(255)"], "sample_data": [[1, "Alice Johnson", "alice@email.com"], [2, "Bob Smith", "bob@email.com"], [3, "Carol White", "carol@email.com"]]},
    {"name": "orders", "columns": ["order_id SERIAL PRIMARY KEY", "customer_id INT REFERENCES customers(customer_id)", "amount DECIMAL(10,2)", "order_date DATE"], "sample_data": [[1, 1, 500.00, "2024-01-10"], [2, 1, 750.00, "2024-01-15"], [3, 2, 200.00, "2024-01-12"], [4, 3, 1500.00, "2024-01-20"]]}
  ],
  "setup_sql": "CREATE TABLE customers (customer_id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(255)); CREATE TABLE orders (order_id SERIAL PRIMARY KEY, customer_id INT, amount DECIMAL(10,2), order_date DATE); INSERT INTO customers (name, email) VALUES ('Alice Johnson', 'alice@email.com'), ('Bob Smith', 'bob@email.com'), ('Carol White', 'carol@email.com'); INSERT INTO orders (customer_id, amount, order_date) VALUES (1, 500.00, '2024-01-10'), (1, 750.00, '2024-01-15'), (2, 200.00, '2024-01-12'), (3, 1500.00, '2024-01-20');",
  "expected_query": "SELECT c.name, SUM(o.amount) AS total_spent FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.name HAVING SUM(o.amount) > 1000 ORDER BY total_spent DESC;",
  "expected_columns": ["name", "total_spent"],
  "hints": ["You need to combine data from two tables", "Use GROUP BY with an aggregate function", "HAVING filters after aggregation"]
}""",

    "hard": """{
  "title": "Running Revenue by Month",
  "description": "Calculate each month's revenue and the cumulative running total of revenue. Show the month (as date), monthly revenue, and running total. Order by month ascending.",
  "tables": [
    {"name": "orders", "columns": ["order_id SERIAL PRIMARY KEY", "amount DECIMAL(10,2)", "created_at DATE"], "sample_data": [[1, 500.00, "2024-01-15"], [2, 750.00, "2024-01-20"], [3, 300.00, "2024-02-10"], [4, 900.00, "2024-02-25"], [5, 450.00, "2024-03-05"]]}
  ],
  "setup_sql": "CREATE TABLE orders (order_id SERIAL PRIMARY KEY, amount DECIMAL(10,2), created_at DATE); INSERT INTO orders (amount, created_at) VALUES (500.00, '2024-01-15'), (750.00, '2024-01-20'), (300.00, '2024-02-10'), (900.00, '2024-02-25'), (450.00, '2024-03-05');",
  "expected_query": "WITH monthly AS (SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS revenue FROM orders GROUP BY DATE_TRUNC('month', created_at)) SELECT month, revenue, SUM(revenue) OVER (ORDER BY month) AS running_total FROM monthly ORDER BY month;",
  "expected_columns": ["month", "revenue", "running_total"],
  "hints": ["Aggregate by month first", "Consider using a CTE or subquery", "Window functions can compute running totals with SUM() OVER()"]
}"""
}

# Difficulty guide for prompts
DIFFICULTY_GUIDE = {
    "easy": "Single table, basic SELECT/WHERE/ORDER BY, 1-2 conditions, no JOINs",
    "medium": "1-2 JOINs, GROUP BY + HAVING, basic subqueries, 2-3 tables",
    "hard": "Multiple JOINs, window functions (ROW_NUMBER, RANK, SUM OVER), CTEs, complex aggregations, 3-5 tables",
}


def build_prompt(difficulty: str, domain: str) -> str:
    """Build the question generation prompt."""
    max_tables = {"easy": 1, "medium": 3, "hard": 5}.get(difficulty, 3)
    
    return f"""Generate a SQL practice question.

DIFFICULTY: {difficulty}
DIFFICULTY REQUIREMENTS: {DIFFICULTY_GUIDE.get(difficulty, DIFFICULTY_GUIDE["medium"])}

DOMAIN: {domain}

OUTPUT FORMAT (strict JSON, no markdown code blocks):
{{
  "title": "Short descriptive title (3-6 words)",
  "description": "2-3 sentence problem statement. State WHAT to find, not HOW. Be specific about output requirements.",
  "tables": [
    {{
      "name": "table_name",
      "columns": ["col1 TYPE", "col2 TYPE"],
      "sample_data": [["val1", "val2"], ...]
    }}
  ],
  "setup_sql": "CREATE TABLE ...; INSERT INTO ... VALUES ...;",
  "expected_query": "SELECT ...",
  "expected_columns": ["col1", "col2"],
  "hints": ["Hint 1 (vague)", "Hint 2 (more specific)", "Hint 3 (nearly gives it away)"]
}}

CONSTRAINTS:
- Tables: 1-{max_tables} tables, max {settings.max_practice_rows} total rows across all tables
- Column names: Use snake_case (user_id, created_at, total_amount)
- Data: Use realistic values (real names, plausible dates, sensible amounts). NO placeholder text like "test", "example", "foo".
- expected_query: Must be deterministic. Always include ORDER BY if results could vary.
- PostgreSQL 14 syntax only. Use appropriate types (SERIAL, VARCHAR, DECIMAL, DATE, TIMESTAMP, BOOLEAN).
- Ensure all foreign key references are valid in the sample data.

EXAMPLE for {difficulty} difficulty:
{FEW_SHOTS.get(difficulty, FEW_SHOTS["medium"])}

Generate a DIFFERENT question in the {domain} domain. Be creative with the scenario."""


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
