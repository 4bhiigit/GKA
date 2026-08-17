import { Repository, IngestionProgress, FileNode, ChatMessage, Citation, User, GitHubUserRepo, RepoFileContent } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthHeaders(userId?: string): HeadersInit {
  const token = userId || (typeof window !== 'undefined' ? localStorage.getItem('gka_user_id') : null);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

// Authentication API
export async function exchangeGitHubCode(code: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/auth/github/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to exchange GitHub code');
  return data;
}

export async function fetchCurrentUser(userId?: string): Promise<User | null> {
  try {
    const token = userId || (typeof window !== 'undefined' ? localStorage.getItem('gka_user_id') : null);
    if (!token) {
      return null;
    }

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function fetchUserGitHubRepos(userId?: string): Promise<GitHubUserRepo[]> {
  const res = await fetch(`${API_BASE}/auth/user-repos`, {
    headers: getAuthHeaders(userId),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch personal GitHub repositories');
  }
  const data = await res.json();
  return data.repos || [];
}

// Repositories API
export async function fetchRepos(userId?: string): Promise<Repository[]> {
  const res = await fetch(`${API_BASE}/repos`, {
    headers: getAuthHeaders(userId),
  });
  if (!res.ok) throw new Error('Failed to fetch repositories');
  const data = await res.json();
  return data.repositories || [];
}

export async function fetchRepo(id: string): Promise<Repository> {
  const res = await fetch(`${API_BASE}/repos/${id}`);
  if (!res.ok) throw new Error('Failed to fetch repository');
  const data = await res.json();
  return data.repository;
}

export async function importRepository(
  githubUrl: string,
  branch?: string,
  userId?: string
): Promise<{ repository: Repository; message: string }> {
  const res = await fetch(`${API_BASE}/repos/import`, {
    method: 'POST',
    headers: getAuthHeaders(userId),
    body: JSON.stringify({ githubUrl, branch, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import repository');
  return data;
}

export async function fetchRepoStatus(id: string): Promise<IngestionProgress> {
  const res = await fetch(`${API_BASE}/repos/${id}/status`);
  if (!res.ok) throw new Error('Failed to fetch repository status');
  const data = await res.json();
  return data.progress;
}

export async function fetchRepoFiles(id: string): Promise<FileNode[]> {
  const res = await fetch(`${API_BASE}/repos/${id}/files`);
  if (!res.ok) throw new Error('Failed to fetch files');
  const data = await res.json();
  return data.files || [];
}

export async function fetchRepoFile(
  id: string,
  filePath: string,
  branch?: string,
  userId?: string
): Promise<RepoFileContent> {
  const params = new URLSearchParams({ path: filePath });
  if (branch) params.append('ref', branch);

  const res = await fetch(`${API_BASE}/repos/${id}/file?${params.toString()}`, {
    headers: getAuthHeaders(userId),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      const error: any = new Error(`Backend is updating on Render (HTTP ${res.status}). Please wait ~30 seconds and click again.`);
      error.status = res.status;
      throw error;
    }
    data = { content: text, path: filePath, size: text.length, encoding: 'utf-8', language: 'text', isBinary: false };
  }

  if (!res.ok) {
    const error: any = new Error(data.error || 'Failed to fetch file content');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function fetchRepoSummary(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${id}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to generate summary');
  const data = await res.json();
  return data.summary || '';
}

export async function deleteRepository(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/repos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete repository');
}

export async function fetchChatHistory(repositoryId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/repos/${repositoryId}/chats`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  const data = await res.json();
  return data.chats || [];
}

export async function clearChatHistory(repositoryId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/repos/${repositoryId}/chats`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear chat history');
}

/**
 * Stream chat completions using Server-Sent Events (SSE)
 */
export async function streamChat(
  repositoryId: string,
  message: string,
  provider: 'groq' | 'gemini',
  onToken: (token: string) => void,
  onCitations: (citations: Citation[]) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<() => void> {
  const controller = new AbortController();

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ repositoryId, message, provider }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Chat request failed' }));
      onError(errData.error || `HTTP Error ${response.status}`);
      return () => {};
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('Response body is not readable');
      return () => {};
    }

    const decoder = new TextDecoder();
    let buffer = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = 'message';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.replace('event:', '').trim();
              continue;
            }

            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace('data:', '').trim();
              try {
                const data = JSON.parse(dataStr);
                if (currentEvent === 'citations') {
                  onCitations(data as Citation[]);
                } else if (currentEvent === 'token') {
                  if (data.token) onToken(data.token);
                } else if (currentEvent === 'done') {
                  onDone();
                } else if (currentEvent === 'error') {
                  onError(data.error || 'Chat stream error');
                }
              } catch (e) {
                if (currentEvent === 'token') {
                  onToken(dataStr);
                }
              }
            }
          }
        }
        onDone();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          onError(err.message || 'Stream read error');
        }
      }
    })();
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      onError(err.message || 'Failed to connect to chat API');
    }
  }

  return () => controller.abort();
}
