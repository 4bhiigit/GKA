'use client';

import React from 'react';
import { FileCode } from 'lucide-react';
import { Citation } from '../lib/types';

interface CitationBadgeProps {
  filePath: string;
  startLine: number;
  endLine?: number;
  onClick: (citation: Citation) => void;
  className?: string;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  filePath,
  startLine,
  endLine,
  onClick,
  className = '',
}) => {
  const actualEndLine = endLine || startLine;
  const fileName = filePath.split('/').pop() || filePath;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick({
      filePath,
      startLine,
      endLine: actualEndLine,
    });
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 my-0.5 mx-1 rounded-md text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-amber-500/80 text-zinc-200 hover:text-amber-300 transition-all active:scale-95 shadow-sm align-middle cursor-pointer group ${className}`}
      title={`Inspect ${filePath} (Lines ${startLine}-${actualEndLine})`}
    >
      <FileCode className="w-3 h-3 text-amber-400/90 group-hover:text-amber-400 shrink-0" />
      <span className="font-semibold text-zinc-100 group-hover:text-amber-200 truncate max-w-[150px]">
        {fileName}
      </span>
      <span className="text-zinc-400 text-[10px] group-hover:text-amber-300/80">
        :L{startLine}{actualEndLine !== startLine ? `-${actualEndLine}` : ''}
      </span>
    </button>
  );
};
