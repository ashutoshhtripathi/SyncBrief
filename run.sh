#!/bin/bash
set -e

echo "=========================================================="
echo "⚡ Starting SyncBrief AI (Microsoft Innovate 2026 Hackathon)"
echo "   Tagline: Async updates. Verifiable evidence. Zero status meetings."
echo "=========================================================="

# Resolve python and node
PYTHON_EXEC="backend/.venv/bin/python"
if [ ! -f "$PYTHON_EXEC" ]; then
    echo "Creating Python virtual environment..."
    ~/.local/bin/uv venv backend/.venv --python /opt/anaconda3/bin/python3
    ~/.local/bin/uv pip install -r backend/requirements.txt --python backend/.venv/bin/python
fi

echo "1. Seeding realistic 2-week team evidence database..."
PYTHONPATH=. $PYTHON_EXEC backend/app/seed.py

echo "2. Launching FastAPI Backend on http://127.0.0.1:8000..."
PYTHONPATH=. $PYTHON_EXEC -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "3. Launching Vite React Frontend on http://localhost:5173..."
cd frontend
/opt/anaconda3/bin/npm run dev -- --host 127.0.0.1 &
FRONTEND_PID=$!
cd ..

cleanup() {
    echo ""
    echo "Stopping SyncBrief AI services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "🚀 SyncBrief AI is running live!"
echo "   Frontend Web App: http://localhost:5173"
echo "   Backend REST API: http://127.0.0.1:8000"
echo "   OpenAPI Docs:     http://127.0.0.1:8000/docs"
echo "   Press Ctrl+C to terminate both servers."
echo ""

wait
