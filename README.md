# CRC One — Career Readiness Cell Management System

CRC One is the single source of truth for the Career Readiness Cell (CRC) at Lexicon MILE.

## Tech Stack
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic
- **Database:** PostgreSQL 16
- **Auth:** JWT (access + refresh) via `python-jose`, password hashing via `passlib[bcrypt]`
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand
- **Agents:** APScheduler running in-process AI agents

## Quick Start (Docker)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker compose up --build
   ```

3. Frontend: `http://localhost:5173`
4. Backend API docs: `http://localhost:8000/docs`

## Local Development (without Docker)

### Backend:
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --reload-dir app
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Running Tests

- **Backend:** `pytest` in `backend/`
- **Frontend:** `npm run test` in `frontend/`
