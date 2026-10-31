# Alaap-AI-Agent-Music-Therapy-

## Project layout

```text
MUSIC_Therapy_App/
├── RAG DOCs/                      # supplied PDFs and DOCX corpus
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI sessions, chat, safety route, music search
│   │   └── rag/ingest.py          # semantic chunking + local Chroma index
│   └── data/chroma/               # created by ingestion (git-ignored in production)
├── src/
│   ├── app/                       # Next.js App Router shell
│   └── components/MoodCheckIn.tsx # Step 1 valence/arousal check-in
├── package.json
└── requirements.txt
```

## Run locally

1. Install Node.js 20.9 or newer and Python 3.11 or newer.
2. In the project root, run `npm install`, then `npm run dev`.
3. In a second PowerShell terminal, run `uv python install 3.13`, `uv venv --python 3.13 .venv`, `.\.venv\Scripts\Activate.ps1`, then `python -m pip install -r requirements.txt`.
4. Ollama is the local chat model provider. The default is `qwen3.5:4b`; it is already installed on this machine. Jamendo search credentials are in `.env` (copy `.env.example` to create it on another machine). If Ollama is unavailable, the app falls back to local response templates.
5. Start the API from the project root with `uvicorn backend.app.main:app --reload --port 8000`.
6. In a terminal with the Python environment active, run `python -m backend.app.rag.ingest` to create the local Chroma index. The first run downloads the local sentence-transformer model. The app can still chat before indexing, but it won't have retrieved document context.

The interface runs at `http://localhost:3000`; FastAPI docs are at `http://localhost:8000/docs`.

## Part 1 capabilities

- Mood baseline on the valence/arousal map and emotion selector.
- Goal selection (settle, process, lift), guided listening or original songwriting, and chat.
- First-person self-harm phrase routing to a fixed support message before normal chat; crisis source retrieval is attempted first when Chroma is indexed.
- Semantic PDF/DOCX chunking and category-tagged local Chroma retrieval.
- Chat music requests search Jamendo and return the exact playable tracks and license links in the assistant reply, so the bot doesn't recommend unrelated songs from memory.
- Jamendo catalog search in two passes (baseline-matched query, then target-mood query), with in-app audio streaming and track-license attribution.
- Post-session mood re-check and displayed valence/arousal deltas.

Jamendo results are Creative Commons tracks; each track's license should be checked and followed. Search results are music discovery suggestions, not clinical recommendations.

The mood map is a reflective check-in, not a diagnosis or efficacy measure. This localhost prototype stores sessions in process memory and clears them when the API restarts. The phrase detector can miss or misread risk language; this is not a clinical screening tool or crisis service. Do not rely on it for emergency care.
