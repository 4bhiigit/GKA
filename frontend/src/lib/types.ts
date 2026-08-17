export interface User {
  id: string;
  githubId: string;
  username: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface GitHubUserRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string;
  isPrivate: boolean;
  htmlUrl: string;
  defaultBranch: string;
  language?: string;
  stars: number;
  updatedAt: string;
}

export interface Repository {
  id: string;
  userId?: string;
  githubUrl: string;
  owner: string;
  name: string;
  defaultBranch: string;
  description?: string;
  isPrivate?: boolean;
  status: 'pending' | 'indexing' | 'ready' | 'failed';
  progress: number;
  progressStage: string;
  errorMessage?: string;
  fileCount: number;
  chunkCount: number;
  languages?: string;
  summary?: string;
  fileTree?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sourceFiles?: Citation[];
  createdAt: string;
  isStreaming?: boolean;
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

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}
