# AIDE

Local SQL practice app with:
- FastAPI backend + PostgreSQL
- React/Vite frontend with Monaco editor
- OpenRouter-powered question generation

## Requirements

- PostgreSQL running locally
- Python 3.11+
- Node.js 18+
- OpenRouter API key

## Quick Start

1. Create DB:
```bash
createdb aide
```

2. Backend setup:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Frontend setup:
```bash
cd frontend
npm install
```

4. Configure backend env at `backend/.env`:
```env
DATABASE_URL=postgresql://localhost:5432/aide
OPENROUTER_API_KEY=your_key_here
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini
OPENROUTER_ALLOWED_MODELS=openai/gpt-4o-mini,google/gemini-3-flash-preview,z-ai/glm-5
```

5. Run both services from repo root:
```bash
./run-dev.sh
```

Frontend: `http://127.0.0.1:5173`  
Backend: `http://127.0.0.1:8000`

## Useful Commands

```bash
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm test
cd frontend && npm run test:browser
```
