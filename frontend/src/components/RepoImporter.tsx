'use client';

import React, { useState, useEffect } from 'react';
import { X, Github, ArrowRight, Loader2, Lock, Unlock, Search, Sparkles, FolderGit2, Check } from 'lucide-react';
import { importRepository, fetchRepoStatus, fetchUserGitHubRepos } from '../lib/api';
import { Repository, IngestionProgress, User, GitHubUserRepo } from '../lib/types';

interface RepoImporterProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: (repo: Repository) => void;
}

const SAMPLE_REPOS = [
  { name: 'expressjs/express-paginate', url: 'https://github.com/expressjs/express-paginate', desc: 'Express pagination middleware' },
  { name: 'octocat/Hello-World', url: 'https://github.com/octocat/Hello-World', desc: 'Minimal starter benchmark repo' },
  { name: 'fastify/fastify-jwt', url: 'https://github.com/fastify/fastify-jwt', desc: 'Fastify JWT auth plugin' },
];

export const RepoImporter: React.FC<RepoImporterProps> = ({ isOpen, user, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'url' | 'my-repos'>('url');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<IngestionProgress | null>(null);

  // User repositories state
  const [userRepos, setUserRepos] = useState<GitHubUserRepo[]>([]);
  const [loadingUserRepos, setLoadingUserRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  // Load user's personal GitHub repositories when tab changes
  useEffect(() => {
    if (user && activeTab === 'my-repos' && userRepos.length === 0) {
      setLoadingUserRepos(true);
      fetchUserGitHubRepos(user.id)
        .then((repos) => setUserRepos(repos))
        .catch((err) => console.error('Failed to load user repos:', err))
        .finally(() => setLoadingUserRepos(false));
    }
  }, [user, activeTab, userRepos.length]);

  // Real-time status polling
  useEffect(() => {
    let interval: any = null;

    if (activeJobId && loading) {
      interval = setInterval(async () => {
        try {
          const status = await fetchRepoStatus(activeJobId);
          setProgressData(status);

          if (status.status === 'ready') {
            clearInterval(interval);
            setLoading(false);
            onSuccess({
              id: activeJobId,
              userId: user?.id,
              githubUrl: url,
              owner: url.split('/')[3] || '',
              name: url.split('/')[4] || '',
              defaultBranch: branch || 'main',
              status: 'ready',
              progress: 100,
              progressStage: 'Ready',
              fileCount: status.totalFiles,
              chunkCount: status.totalChunks,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else if (status.status === 'failed') {
            clearInterval(interval);
            setLoading(false);
            setError(status.error || 'Repository indexing failed.');
          }
        } catch (err: any) {
          console.error('Status poll error:', err);
        }
      }, 1200);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJobId, loading, url, branch, onSuccess, user]);

  if (!isOpen) return null;

  const handleSubmit = async (targetUrl?: string, targetBranch?: string) => {
    const urlToImport = targetUrl || url;
    if (!urlToImport.trim()) return;

    setError(null);
    setLoading(true);
    setProgressData({
      repositoryId: '',
      status: 'indexing',
      progress: 5,
      stage: 'Connecting to GitHub API...',
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
    });

    try {
      const res = await importRepository(urlToImport.trim(), targetBranch || branch.trim() || undefined, user?.id);
      setActiveJobId(res.repository.id);

      if (res.repository.status === 'ready') {
        setLoading(false);
        onSuccess(res.repository);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import repository');
      setLoading(false);
    }
  };

  const filteredUserRepos = userRepos.filter((r) =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#09090b] border border-zinc-800 rounded-xl p-5 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Close Button */}
        {!loading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Import Repository
            </h2>
            <p className="text-xs text-zinc-400">
              Index source code for semantic search & AI chat
            </p>
          </div>
        </div>

        {/* Tabs (Custom URL vs My Repositories) */}
        {!loading && user && (
          <div className="flex items-center border-b border-zinc-800 mb-4 shrink-0">
            <button
              onClick={() => setActiveTab('url')}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'url'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Custom URL
            </button>
            <button
              onClick={() => setActiveTab('my-repos')}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'my-repos'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>My GitHub Repos</span>
              {userRepos.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                  {userRepos.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Form: Custom URL Tab */}
        {!loading && activeTab === 'url' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4 overflow-y-auto"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                GitHub Repository URL
              </label>
              <div className="relative">
                <Github className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-500 transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Branch <span className="text-zinc-500 font-normal">(optional, default: main)</span>
              </label>
              <input
                type="text"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-500 transition-all font-mono"
              />
            </div>

            {/* Sample Repositories */}
            <div className="pt-1">
              <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3 text-zinc-300" />
                Try open-source benchmarks:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SAMPLE_REPOS.map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => {
                      setUrl(sample.url);
                    }}
                    className="text-left p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all"
                  >
                    <div className="text-[11px] font-medium text-zinc-200 truncate">
                      {sample.name.split('/')[1]}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {sample.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-red-500/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-white hover:bg-zinc-200 text-black transition-all active:scale-95 shadow-sm"
              >
                <span>Start Ingestion</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: 1-Click My GitHub Repositories Picker */}
        {!loading && activeTab === 'my-repos' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Search personal repos */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search your GitHub repositories..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
              />
            </div>

            {/* Repos list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[300px]">
              {loadingUserRepos ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-center text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                  <p className="text-xs">Fetching your repositories from GitHub...</p>
                </div>
              ) : filteredUserRepos.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No matching repositories found.
                </div>
              ) : (
                filteredUserRepos.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between transition-all group"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {r.name}
                        </span>
                        {r.isPrivate ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] bg-zinc-800 border border-zinc-700 text-zinc-400">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] bg-zinc-800 border border-zinc-700 text-zinc-400">
                            Public
                          </span>
                        )}
                        {r.language && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            • {r.language}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate max-w-sm">
                        {r.description || 'No description'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setUrl(r.htmlUrl);
                        setBranch(r.defaultBranch);
                        handleSubmit(r.htmlUrl, r.defaultBranch);
                      }}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-black hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      <span>Ingest</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Live Progress Tracker */}
        {loading && (
          <div className="py-6 space-y-5">
            <div className="text-center space-y-1.5">
              <div className="inline-flex p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white mb-1">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Indexing Repository Codebase
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                {url}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium">
                  {progressData?.stage || 'Processing repository...'}
                </span>
                <span className="text-zinc-400 font-mono">
                  {progressData?.progress || 10}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, progressData?.progress || 10)}%` }}
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                <div className="text-[10px] text-zinc-500 font-medium">Files</div>
                <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                  {progressData?.totalFiles || '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                <div className="text-[10px] text-zinc-500 font-medium">Chunks</div>
                <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                  {progressData?.totalChunks || '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                <div className="text-[10px] text-zinc-500 font-medium">Status</div>
                <div className="text-xs font-semibold text-zinc-200 capitalize mt-0.5">
                  {progressData?.status || 'Indexing'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
