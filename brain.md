# PROJECT: GitHub Knowledge Assistant (GKA)
### AI-powered platform to chat with any GitHub repository's codebase using RAG

---

## 1. OVERVIEW

Build a full-stack web app where a user pastes any public GitHub repository URL, the system ingests and indexes the entire codebase, and the user can then chat with the codebase in natural language — ask about architecture, specific functions, bugs, commit history, etc.

**Core concept:** Retrieval-Augmented Generation (RAG) applied to source code.

**Constraint: FREE-TIER ONLY.** No paid APIs, no paid vector DB hosting, no paid LLM subscriptions. Everything must run on free tiers or self-hosted via Docker.

---

## 2. TECH STACK (Free-tier only — do not substitute with paid services)

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui components
- react-markdown (for rendering AI responses with code blocks)

### Backend
- Node.js + Express.js
- TypeScript (strict mode)

### Database
- PostgreSQL (via Docker, local) — stores repo metadata, chat history, user sessions
- Prisma ORM

### Vector Database
- Qdrant (self-hosted via Docker) — free, no cloud billing
- Alternative fallback: ChromaDB (even lighter, embedded, no separate server needed for MVP)

### Embeddings
- `sentence-transformers` (`all-MiniLM-L6-v2`) run locally via a small Python microservice, OR
- Gemini `text-embedding-004` (free tier, generous quota) if you want to avoid running a Python service

### LLM (for chat generation)
- Groq API (free, extremely fast inference) — models: `llama-3.3-70b-versatile` or `deepseek-r1-distill`
- Fallback: Gemini 1.5/2.0 Flash (free tier)
- DO NOT use OpenAI/Claude paid API for this project

### Chunking / RAG orchestration
- LangChain.js (`RecursiveCharacterTextSplitter` with code-aware separators)
- Custom AST-based chunker for Phase 2 upgrade (optional, using `tree-sitter`)

### Infrastructure
- Docker + docker-compose (Postgres + Qdrant + backend, all containerized)
- Redis (Docker) — for caching indexing job status and rate-limiting GitHub API calls

### External APIs
- GitHub REST API (free, unauthenticated 60 req/hr — use GitHub Student Pack token to raise to 5000 req/hr)

---

## 3. ARCHITECTURE / DATA FLOW

```
User pastes GitHub URL
      ↓
Backend validates URL → fetches repo tree via GitHub API
      ↓
Filter files (skip node_modules, .git, binaries, lockfiles, images)
      ↓
Fetch raw content of relevant files (respect GitHub rate limits, use Redis queue)
      ↓
Chunk each file (function/class-aware splitting, ~300-500 tokens per chunk, 50 token overlap)
      ↓
Generate embeddings for each chunk (batch requests)
      ↓
Store in Qdrant: { vector, payload: { repo_id, file_path, chunk_text, start_line, end_line, language } }
      ↓
Store indexing metadata in PostgreSQL (repo status: pending/indexing/ready/failed)
      ↓
--- User asks a question in chat ---
      ↓
Embed the user's question
      ↓
Query Qdrant: top-k (5-8) most similar chunks for that repo_id
      ↓
Build prompt: system instructions + retrieved chunks (with file paths) + chat history + user question
      ↓
Send to Groq/Gemini LLM → stream response back to frontend
      ↓
Save Q&A pair to PostgreSQL chat history
```

---

## 4. DATABASE SCHEMA (Prisma)

```prisma
model Repository {
  id          String   @id @default(cuid())
  githubUrl   String   @unique
  owner       String
  name        String
  status      String   // pending | indexing | ready | failed
  fileCount   Int      @default(0)
  chunkCount  Int      @default(0)
  createdAt   DateTime @default(now())
  chats       Chat[]
}

model Chat {
  id           String   @id @default(cuid())
  repositoryId String
  repository   Repository @relation(fields: [repositoryId], references: [id])
  role         String   // user | assistant
  content      String   @db.Text
  sourceFiles  String[] // file paths cited in this response
  createdAt    DateTime @default(now())
}
```

---

## 5. BUILD PHASES (feed one phase at a time to Antigravity)

### PHASE 1 — Project Setup & Infrastructure
- Init Next.js frontend + Express backend as monorepo (or two folders)
- Setup docker-compose.yml with: postgres, qdrant, redis services
- Setup Prisma, run initial migration
- Setup env vars: `GITHUB_TOKEN`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `QDRANT_URL`, `DATABASE_URL`, `REDIS_URL`
- Basic health-check endpoint

### PHASE 2 — GitHub Ingestion Module
- Endpoint: `POST /api/repos/import { githubUrl }`
- Parse owner/repo from URL
- Fetch repo tree recursively via GitHub API (`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`)
- Filter: allow only code file extensions (.js, .ts, .py, .java, .go, .rs, .md, etc.), exclude node_modules/.git/dist/build/binary files, max file size cap (e.g. 500KB)
- Fetch raw content of each allowed file
- Save Repository record with status=`pending`, then move to `indexing`

### PHASE 3 — Chunking & Embedding Pipeline
- Implement code-aware chunker (split by function/class boundaries where possible, else recursive character split with code separators like `\nclass `, `\nfunction `, `\ndef `)
- Chunk size ~400 tokens, overlap ~50 tokens
- Batch-generate embeddings (sentence-transformers microservice or Gemini embedding API)
- Push vectors to Qdrant with payload metadata (repo_id, file_path, start_line, end_line, chunk_text)
- Update Repository status to `ready` once done; handle failures gracefully (status=`failed`)
- Use a background job queue (simple Redis-based queue or `bullmq`) so import doesn't block the request

### PHASE 4 — Semantic Search & Chat API
- Endpoint: `POST /api/chat { repoId, message, chatHistory }`
- Embed user query → Qdrant similarity search (top-k=6, filtered by repo_id)
- Construct RAG prompt:
  ```
  System: You are a codebase assistant for {repo_name}. Answer using ONLY the provided code context. 
  Cite file paths and line numbers. If context is insufficient, say so.
  
  Context:
  [file: src/auth.js, lines 10-40]
  <chunk text>
  ...
  
  Chat history: ...
  User question: {message}
  ```
- Stream response from Groq/Gemini back to frontend (SSE or chunked response)
- Save chat turn to PostgreSQL

### PHASE 5 — Frontend UI
- Landing page: input field for GitHub URL, "Import Repository" button
- Indexing progress screen (poll `/api/repos/:id/status` or use websocket for live progress: "Fetching files... Chunking... Embedding... Ready")
- Chat interface: sidebar with file tree (optional), main chat panel with markdown+syntax-highlighted code rendering, source file citations shown under each AI answer
- Repo history/dashboard: list of previously imported repos

### PHASE 6 — Extra Features (stretch goals, do after MVP works)
- Architecture summary generator (one-shot LLM call summarizing folder structure + key files)
- Auto documentation generator (per-file docstring generation)
- Bug detection pass (LLM reviews flagged files for common issues)
- Commit history analysis (fetch commits via GitHub API, summarize recent changes)
- File-level semantic search (search bar separate from chat, returns ranked file/chunk matches)

---

## 6. KEY IMPLEMENTATION NOTES FOR ANTIGRAVITY

- Always wrap external API calls (GitHub, Groq, Gemini, Qdrant) in try/catch with retries (exponential backoff) — free tiers rate-limit aggressively
- Rate-limit GitHub API calls using Redis token bucket, especially for large repos
- Cap total files indexed per repo (e.g. 300 files) to stay within free-tier embedding quotas
- Stream LLM responses to frontend, don't wait for full completion
- Keep Qdrant collection per-repo OR single collection with `repo_id` filter (single collection is simpler, prefer this)
- Write all secrets to `.env`, never hardcode
- Add a `/health` and `/api/repos/:id/status` endpoint early — needed for polling UI

---

## 7. HOW TO USE THIS FILE

Feed Phase 1 to Antigravity first as an isolated, exhaustive prompt. Once it's working and tested, move to Phase 2, and so on. Do not feed multiple phases at once — this matches your existing iterative build pattern from AEGIS/SecureExam.
