# How to run this

## Backend (FastAPI)

```bash
pip install fastapi uvicorn

# Run the API server
uvicorn api:app --reload
# Now running at http://localhost:8000
```

Test it directly in your browser:
- http://localhost:8000/api/hello
- http://localhost:8000/api/transactions
- http://localhost:8000/api/summary/by-category

FastAPI also gives you free interactive docs at:
- http://localhost:8000/docs  ← try your endpoints here without React


## Frontend (React + Vite)

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install

# Replace src/App.jsx with the App.jsx file provided
# Then run:
npm run dev
# Now running at http://localhost:5173
```

Open http://localhost:5173 — you'll see all three components
each calling a different API endpoint.


## What to notice

1. FastAPI and React are TWO separate servers running at the same time
2. React calls FastAPI using fetch() — that's the only connection between them
3. The CORS middleware in api.py is what ALLOWS React to call FastAPI
   (browsers block cross-origin requests by default)
4. Each component is independent — they each manage their own loading state
