export interface RepoFile {
  path: string;
  size: number;
  type: 'blob' | 'tree';
  sha: string;
  url?: string;
  content?: string;
  language?: string;
}

export interface CodeChunk {
  id: string;
  repositoryId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  tokenEstimate: number;
}

export interface VectorSearchResult {
  id: string;
  repositoryId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  score: number;
}

export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet?: string;
}

export interface IngestionProgress {
  repositoryId: string;
  status: 'pending' | 'indexing' | 'ready' | 'failed';
  progress: number;
  stage: string;
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  error?: string;
}
