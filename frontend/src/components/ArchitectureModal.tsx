'use client';

import React, { useState } from 'react';
import { X, Sparkles, Database, RefreshCw, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchRepoSummary } from '../lib/api';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId: string;
  repoName: string;
  initialSummary?: string;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
  repositoryId,
  repoName,
  initialSummary,
}) => {
  const [summary, setSummary] = useState(initialSummary || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetchRepoSummary(repositoryId);
      setSummary(res);
    } catch (err) {
      console.error('Failed to regenerate architecture summary', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#09090b] border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Architecture Overview
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                {repoName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-white animate-spin" />
              <p className="text-xs text-zinc-300">
                Synthesizing architecture with LLM...
              </p>
            </div>
          ) : summary ? (
            <div className="markdown-body text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summary}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No architecture summary cached. Click below to generate one.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-zinc-200 text-black transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
