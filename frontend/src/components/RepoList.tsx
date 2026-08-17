'use client';

import React, { useState } from 'react';
import { Repository } from '../lib/types';
import { FolderGit2, Trash2, ArrowRight, MessageSquare, Layers, FileCode2, Clock, CheckCircle2, AlertCircle, Loader2, Search } from 'lucide-react';

interface RepoListProps {
  repositories: Repository[];
  onSelectRepo: (repo: Repository) => void;
  onDeleteRepo: (id: string, e: React.MouseEvent) => void;
  onOpenImporter: () => void;
}

export const RepoList: React.FC<RepoListProps> = ({
  repositories,
  onSelectRepo,
  onDeleteRepo,
  onOpenImporter,
}) => {
  const [search, setSearch] = useState('');

  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.owner.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (repositories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-4">
          <FolderGit2 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          No repositories indexed yet
        </h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-6">
          Import any public GitHub repository to index its codebase and start chatting with it using RAG.
        </p>
        <button
          onClick={onOpenImporter}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black font-medium transition-all text-xs active:scale-95 shadow-sm"
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Import Repository</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            Indexed Repositories
          </h2>
          <p className="text-xs text-zinc-400">
            Select a repository to open chat or inspect its codebase
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search repos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48 bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
            />
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
            {filteredRepos.length}
          </span>
        </div>
      </div>

      {/* Grid of Repositories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredRepos.map((repo) => {
          let languagesObj: Record<string, number> = {};
          try {
            if (repo.languages) languagesObj = JSON.parse(repo.languages);
          } catch {}

          const topLanguages = Object.entries(languagesObj)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang]) => lang);

          return (
            <div
              key={repo.id}
              onClick={() => repo.status === 'ready' && onSelectRepo(repo)}
              className={`bw-card rounded-xl p-4 flex flex-col justify-between ${
                repo.status === 'ready'
                  ? 'cursor-pointer hover:border-zinc-500'
                  : 'opacity-80'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-white text-xs truncate">
                        {repo.name}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">
                        {repo.owner}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {repo.status === 'ready' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        Ready
                      </span>
                    )}
                    {repo.status === 'indexing' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-white" />
                        Indexing
                      </span>
                    )}
                    {repo.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 border border-red-900 text-red-400">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 line-clamp-2 min-h-[2rem] mb-3">
                  {repo.description || 'No repository description available.'}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 py-2 border-y border-zinc-900 mb-3 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      <strong className="text-zinc-200">{repo.fileCount}</strong> files
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      <strong className="text-zinc-200">{repo.chunkCount}</strong> chunks
                    </span>
                  </div>
                </div>

                {/* Languages */}
                {topLanguages.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    {topLanguages.map((lang) => (
                      <span
                        key={lang}
                        className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400"
                      >
                        .{lang}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-1 text-[10px]">
                <div className="flex items-center gap-1 text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(repo.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => onDeleteRepo(repo.id, e)}
                    className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Delete repository"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {repo.status === 'ready' && (
                    <button
                      onClick={() => onSelectRepo(repo)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white text-black hover:bg-zinc-200 text-[11px] font-medium transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
