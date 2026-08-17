'use client';

import React, { useState } from 'react';
import { X, Copy, Check, FileCode, ExternalLink } from 'lucide-react';
import { Citation } from '../lib/types';

interface CitationViewerProps {
  citation: Citation | null;
  onClose: () => void;
  repoUrl?: string;
  defaultBranch?: string;
}

export const CitationViewer: React.FC<CitationViewerProps> = ({
  citation,
  onClose,
  repoUrl,
  defaultBranch = 'main',
}) => {
  const [copied, setCopied] = useState(false);

  if (!citation) return null;

  const handleCopy = () => {
    if (citation.snippet) {
      navigator.clipboard.writeText(citation.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const githubFileUrl = repoUrl
    ? `${repoUrl}/blob/${defaultBranch}/${citation.filePath}#L${citation.startLine}-L${citation.endLine}`
    : undefined;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-[#09090b] border-l border-zinc-800 shadow-2xl flex flex-col animate-slide-left">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-black">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shrink-0">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-white truncate">
              {citation.filePath.split('/').pop()}
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono truncate">
              {citation.filePath}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {githubFileUrl && (
            <a
              href={githubFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="View on GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Pill */}
      <div className="px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          Lines: <strong className="text-white font-mono">{citation.startLine} — {citation.endLine}</strong>
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Snippet Content */}
      <div className="flex-1 p-3.5 overflow-y-auto font-mono text-xs text-zinc-200 bg-black">
        {citation.snippet ? (
          <pre className="whitespace-pre-wrap break-words leading-relaxed font-mono text-zinc-300">
            {citation.snippet}
          </pre>
        ) : (
          <div className="text-zinc-600 italic py-8 text-center text-xs">
            No preview snippet available for this citation.
          </div>
        )}
      </div>
    </div>
  );
};
