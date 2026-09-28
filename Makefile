.PHONY: install seed test dev run docker-up

install:
	~/.local/bin/uv pip install -r backend/requirements.txt --python backend/.venv/bin/python
	cd frontend && npm install

seed:
	PYTHONPATH=. backend/.venv/bin/python backend/app/seed.py

test:
	PYTHONPATH=. backend/.venv/bin/pytest backend/tests -v
	cd frontend && npm test -- --run

dev:
	chmod +x run.sh && ./run.sh

docker-up:
	docker compose up --build
