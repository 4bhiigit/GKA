import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  groqApiKey: process.env.GROQ_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  defaultLlmProvider: (process.env.DEFAULT_LLM_PROVIDER || 'groq') as 'groq' | 'gemini',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  embeddingProvider: (process.env.EMBEDDING_PROVIDER || 'gemini') as 'gemini' | 'local',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',

  vectorStoreType: (process.env.VECTOR_STORE_TYPE || 'embedded') as 'embedded' | 'qdrant',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY || '',

  githubToken: process.env.GITHUB_TOKEN || '',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  maxFilesPerRepo: parseInt(process.env.MAX_FILES_PER_REPO || '250', 10),
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '300000', 10), // ~300KB
};
