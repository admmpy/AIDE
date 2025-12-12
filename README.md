# AIDE - SQL Practice Platform

Artificially Intelligent Development Environment for SQL learning.

A local SQL IDE with LLM-powered practice question generation, similar to LeetCode/HackerRank for SQL. Ultimately will be capable of producing practice questions for targeted areas e.g. utiliing window functions

## Features

- **SQL Editor**: Monaco-based editor with syntax highlighting and autocomplete
- **Practice Mode**: LLM-generated questions with varying difficulty (Easy/Medium/Hard)
- **Answer Checking**: Automatic validation against expected results
- **Progress Tracking**: Local history of solved questions
- **Isolated Environments**: Each practice session runs in its own PostgreSQL schema

## Progression & Next Steps

- Currently generates queries within 15 secs
- The queries generated are quite limited in depth due to model selection (developed to usable on M1 Pro 16gb)

## Prerequisites

1. **PostgreSQL 14** running locally on port 5432
2. **Ollama** with `qwen3:4b` model:
   ```bash
   # Install Ollama: https://ollama.com
   ollama pull qwen3:4b
   ```
3. **Python 3.11+**
4. **Node.js 18+**

## Quick Start

### 1. Set up PostgreSQL

Create a database for AIDE:

```bash
createdb aide
```

Or with psql:

```sql
CREATE DATABASE aide;
```

### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 3. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 4. Start Ollama (if not running)

```bash
ollama serve
```

Open http://localhost:5173 in your browser.

## Project Structure

```
xvr/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings
│   │   ├── database.py          # PostgreSQL connection
│   │   ├── routers/
│   │   │   ├── sql.py           # /sql/execute
│   │   │   └── practice.py      # /practice/*
│   │   ├── services/
│   │   │   ├── sql_executor.py  # Query execution
│   │   │   ├── llm.py           # Ollama client
│   │   │   └── question_gen.py  # Question generation
│   │   └── models/
│   │       └── schemas.py       # Pydantic models
│   ├── requirements.txt
│   └── cleanup.py               # Schema cleanup script
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── stores/
│   └── package.json
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sql/execute` | POST | Execute SQL query |
| `/practice/generate` | POST | Generate new question |
| `/practice/check` | POST | Check answer |
| `/practice/hint/{session_id}` | GET | Get hints |
| `/practice/session/{session_id}` | DELETE | Cleanup session |

## Configuration

The backend uses environment variables (or `.env` file):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aide
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
MAX_QUERY_ROWS=1000
RATE_LIMIT_PER_MINUTE=3
```

## Cleanup

Practice schemas are created per session. To clean up old schemas:

```bash
cd backend
python cleanup.py --max-age-hours 2
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Monaco Editor, Zustand, TanStack Query
- **Backend**: Python 3.11+, FastAPI, asyncpg
- **Database**: PostgreSQL 14
- **LLM**: Ollama with qwen3:4b

## License

MIT
