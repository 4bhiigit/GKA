# 🤖 GitHub Knowledge Assistant (GKA)
### AI-Powered Platform to Chat with any GitHub Repository's Codebase using RAG

GitHub Knowledge Assistant (GKA) ingests public GitHub repositories, builds an intelligent semantic code knowledge graph, and allows developers to chat with the entire codebase in natural language with strict file & line citations.

---

## ⚡ Key Features

- **🚀 Instant GitHub Ingestion**: Ingests repository trees via GitHub API, intelligently filters non-code/lockfiles/binaries, and downloads content with rate-limiting safety.
- **🔍 Code-Aware Semantic Chunking**: Smart splitting along class and function boundaries with exact `startLine` and `endLine` tracking.
- **🧠 100% Free-Tier Architecture**:
  - **Chat LLM**: Groq (`llama-3.3-70b-versatile` / `deepseek-r1-distill`) + Google Gemini (`gemini-2.0-flash`).
  - **Embeddings**: Google Gemini `text-embedding-004` (Free tier) with local high-dimension fallback.
  - **Vector DB**: Zero-setup embedded vector engine (persisted locally) OR self-hosted Docker Qdrant.
  - **Database**: SQLite with Prisma (zero configuration required) or PostgreSQL via Docker.
- **💬 Real-Time Streaming Chat (RAG)**: Streams answers token-by-token with syntax-highlighted code blocks, copy buttons, and clickable source file citations.
- **📂 Interactive File Explorer**: Tree view of the ingested codebase with search and instant inspection.
- **📊 Architecture Overview**: 1-click AI generation of high-level project architecture, key components, and tech stack.

---

## 🏗️ Architecture & Data Flow

```
User pastes GitHub URL
      ↓
Backend validates URL → fetches repo tree via GitHub API
      ↓
Filter files (skip node_modules, .git, binaries, lockfiles, images)
      ↓
Fetch raw content of relevant files (respect GitHub rate limits)
      ↓
Chunk each file (function/class-aware splitting, ~300-500 tokens, line-number tracking)
      ↓
Generate embeddings for each chunk (batch requests via Gemini text-embedding-004)
      ↓
Store in Vector DB (Embedded engine / Qdrant): { vector, payload: { repo_id, file_path, lines } }
      ↓
Store indexing metadata in Prisma (SQLite / Postgres)
      ↓
--- User asks a question in chat ---
      ↓
Embed user question → Query Vector DB for Top-K most relevant chunks
      ↓
Build grounded prompt with exact line spans + chat history
      ↓
Stream response from Groq / Gemini back to frontend via Server-Sent Events (SSE)
```

---

## 🚀 Quick Start (Zero-Setup Local Mode)

### 1. Install Dependencies
```bash
# From the project root
npm run install:all
```

### 2. Configure Environment Keys
Edit `.env` (or `backend/.env`):
```env
PORT=5000
DATABASE_URL="file:./dev.db"

# Free API Keys (Get from https://console.groq.com/ and https://aistudio.google.com/)
GROQ_API_KEY="your-groq-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# Optional: GitHub token to increase API rate limit to 5000 req/hr
GITHUB_TOKEN=""
```

### 3. Initialize Database
```bash
npm run prisma:push
```

### 4. Start Development Servers
```bash
npm run dev
```
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`

---

## 🐳 Docker Deployment (Optional)

If you have Docker installed and want containerized PostgreSQL, Qdrant, and Redis:
```bash
# Start Docker services
docker-compose up -d

# Switch DATABASE_URL and VECTOR_STORE_TYPE in .env:
# DATABASE_URL="postgresql://gka_user:gka_password@localhost:5432/gka_db?schema=public"
# VECTOR_STORE_TYPE="qdrant"
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and provider readiness |
| `POST` | `/api/repos/import` | Start asynchronous repository ingestion |
| `GET` | `/api/repos` | List all indexed repositories |
| `GET` | `/api/repos/:id` | Get single repository metadata |
| `GET` | `/api/repos/:id/status` | Ingestion progress and stage |
| `GET` | `/api/repos/:id/status/stream` | Server-Sent Events real-time progress stream |
| `GET` | `/api/repos/:id/files` | Nested JSON file tree hierarchy |
| `POST` | `/api/repos/:id/summary` | Generate / retrieve architecture summary |
| `POST` | `/api/chat` | Server-Sent Events streaming RAG chat |
| `GET` | `/api/repos/:id/chats` | Get repository conversation history |
| `DELETE` | `/api/repos/:id` | Delete repository and vector index |

---

## 📄 License
MIT
