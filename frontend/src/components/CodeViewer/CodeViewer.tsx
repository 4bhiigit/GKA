'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileCode,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  EyeOff,
  Code2,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { fetchRepoFile } from '../../lib/api';
import { RepoFileContent } from '../../lib/types';
import { highlightCodeWithLines, detectLanguageFromPath, HighlightedLine } from '../../lib/highlighter';

interface CodeViewerProps {
  repoId: string;
  owner: string;
  repoName: string;
  defaultBranch?: string;
  filePath: string;
  highlightLines?: [number, number];
  githubUrl?: string;
  userId?: string;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  repoId,
  owner,
  repoName,
  defaultBranch = 'main',
  filePath,
  highlightLines,
  githubUrl,
  userId,
  onClose,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [fileData, setFileData] = useState<RepoFileContent | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<HighlightedLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string; status?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  // 1. Fetch file content when repoId or filePath changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRepoFile(repoId, filePath, defaultBranch, userId)
      .then((data) => {
        if (!isCancelled) {
          setFileData(data);
          const lang = data.language || detectLanguageFromPath(filePath);

          if (!data.isBinary) {
            highlightCodeWithLines(data.content, lang, highlightLines).then((lines) => {
              if (!isCancelled) {
                setHighlightedLines(lines);
                setIsLoading(false);
              }
            });
          } else {
            setIsLoading(false);
          }
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          console.error('Failed to fetch file content:', err);
          setError({
            message: err.message || 'Failed to load file content',
            code: err.code,
            status: err.status,
          });
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [repoId, filePath, defaultBranch, userId]);

  // 2. Re-highlight if highlightLines range changes
  useEffect(() => {
    if (fileData && !fileData.isBinary && fileData.content) {
      const lang = fileData.language || detectLanguageFromPath(filePath);
      highlightCodeWithLines(fileData.content, lang, highlightLines).then((lines) => {
        setHighlightedLines(lines);
      });
    }
  }, [highlightLines, fileData, filePath]);

  // 3. Auto-scroll to the first highlighted line smoothly
  useEffect(() => {
    if (!isLoading && highlightLines && highlightLines[0] > 0) {
      const timer = setTimeout(() => {
        const lineId = `code-line-${highlightLines[0]}`;
        const el = document.getElementById(lineId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading, highlightLines, filePath]);

  const handleCopyFull = () => {
    if (fileData?.content) {
      navigator.clipboard.writeText(fileData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySnippet = () => {
    if (fileData?.content && highlightLines && highlightLines[0] > 0) {
      const lines = fileData.content.split('\n');
      const start = Math.max(0, highlightLines[0] - 1);
      const end = Math.min(lines.length, highlightLines[1]);
      const snippet = lines.slice(start, end).join('\n');
      navigator.clipboard.writeText(snippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const externalGitHubUrl = githubUrl
    ? `${githubUrl}/blob/${defaultBranch}/${filePath}${
        highlightLines && highlightLines[0] > 0
          ? `#L${highlightLines[0]}-L${highlightLines[1]}`
          : ''
      }`
    : `https://github.com/${owner}/${repoName}/blob/${defaultBranch}/${filePath}`;

  return (
    <div className="h-full flex flex-col bg-[#090a0f] text-zinc-200 border-l border-zinc-800 relative overflow-hidden select-text">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e1017] border-b border-zinc-800/90 shrink-0">
        {/* Left: Breadcrumbs and Citation Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shrink-0">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-white truncate max-w-[220px] sm:max-w-[340px]">
                {filePath}
              </span>
              {highlightLines && highlightLines[0] > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  L{highlightLines[0]}-{highlightLines[1]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy snippet button (if highlighted) */}
          {highlightLines && highlightLines[0] > 0 && (
            <button
              onClick={handleCopySnippet}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-zinc-800/70 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
              title="Copy cited lines"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="hidden sm:inline">Snippet Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">Copy Cited</span>
                </>
              )}
            </button>
          )}

          {/* Copy full file button */}
          <button
            onClick={handleCopyFull}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-zinc-800/70 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
            title="Copy whole file"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">Copy File</span>
              </>
            )}
          </button>

          {/* Open on GitHub */}
          <a
            href={externalGitHubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors"
            title="Open in GitHub"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Full-screen expand toggle */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors hidden sm:block"
              title={isExpanded ? 'Collapse viewer' : 'Expand viewer'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Close Panel Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Code Viewer Body */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-[#0a0c10] font-mono text-xs">
        {isLoading ? (
          /* Loading Skeleton */
          <div className="p-4 space-y-2.5 animate-pulse">
            <div className="h-4 bg-zinc-800/80 rounded w-1/3" />
            <div className="h-4 bg-zinc-800/60 rounded w-2/3" />
            <div className="h-4 bg-zinc-800/50 rounded w-1/2" />
            <div className="h-4 bg-zinc-800/70 rounded w-4/5" />
            <div className="h-4 bg-zinc-800/60 rounded w-3/5" />
            <div className="h-4 bg-zinc-800/80 rounded w-2/5" />
            <div className="h-4 bg-zinc-800/40 rounded w-3/4" />
            <div className="h-4 bg-zinc-800/70 rounded w-1/2" />
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-8 text-center max-w-md mx-auto my-12 space-y-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 mx-auto flex items-center justify-center text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">
                {error.code === 'FILE_NOT_FOUND'
                  ? 'File Not Found on GitHub'
                  : error.code === 'RATE_LIMIT_OR_FORBIDDEN'
                  ? 'GitHub Rate Limit / Access Issue'
                  : 'Unable to Load File'}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">{error.message}</p>
            </div>
            {error.code === 'FILE_NOT_FOUND' && (
              <p className="text-[11px] text-zinc-500">
                This file may have been moved or renamed in a recent commit. Re-indexing the repository will update all citations.
              </p>
            )}
            <a
              href={externalGitHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Check on GitHub</span>
            </a>
          </div>
        ) : fileData?.isBinary ? (
          /* Binary file state */
          <div className="p-8 text-center max-w-md mx-auto my-12 space-y-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-400">
              <EyeOff className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">Binary File Preview</h4>
              <p className="text-xs text-zinc-400">
                This file is a binary/media asset ({filePath.split('.').pop()?.toUpperCase()}) and cannot be rendered as text code.
              </p>
            </div>
            <a
              href={externalGitHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Raw on GitHub</span>
            </a>
          </div>
        ) : (
          /* Shiki Highlighted Code Grid */
          <div className="min-w-full py-2 font-mono text-[12px] leading-relaxed">
            {highlightedLines.map((line) => {
              const isTargetLine = highlightLines && highlightLines[0] === line.lineNumber;

              return (
                <div
                  key={line.lineNumber}
                  id={`code-line-${line.lineNumber}`}
                  ref={isTargetLine ? targetLineRef : undefined}
                  className={`flex items-start transition-colors duration-150 group ${
                    line.isHighlighted
                      ? 'bg-amber-500/15 border-l-2 border-amber-400'
                      : 'hover:bg-zinc-800/40 border-l-2 border-transparent'
                  }`}
                >
                  {/* Line Gutter */}
                  <div
                    className={`w-12 sm:w-14 px-2 py-0.5 text-right select-none shrink-0 font-mono text-[11px] ${
                      line.isHighlighted
                        ? 'text-amber-300 font-bold bg-amber-500/10'
                        : 'text-zinc-600 group-hover:text-zinc-400'
                    }`}
                  >
                    {line.lineNumber}
                  </div>

                  {/* Line Code Content */}
                  <div
                    className="flex-1 px-3 py-0.5 whitespace-pre overflow-x-auto text-zinc-200"
                    dangerouslySetInnerHTML={{ __html: line.html }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      {fileData && !isLoading && !error && (
        <div className="px-3.5 py-1.5 bg-[#090b10] border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>
              Lines: <strong className="text-zinc-300">{highlightedLines.length}</strong>
            </span>
            <span>
              Size: <strong className="text-zinc-300">{(fileData.size / 1024).toFixed(1)} KB</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {fileData.language || 'text'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
