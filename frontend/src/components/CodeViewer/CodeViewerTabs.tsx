'use client';

import React from 'react';
import { X, FileCode, Braces, FileText, File } from 'lucide-react';

export interface CodeTab {
  path: string;
  highlightLines?: [number, number];
}

interface CodeViewerTabsProps {
  tabs: CodeTab[];
  activeTabPath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
  onCloseAll?: () => void;
}

export const CodeViewerTabs: React.FC<CodeViewerTabsProps> = ({
  tabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  onCloseAll,
}) => {
  if (tabs.length === 0) return null;

  const getTabIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
      case 'go':
      case 'rs':
      case 'java':
      case 'c':
      case 'cpp':
      case 'cs':
      case 'rb':
      case 'php':
        return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'json':
      case 'yaml':
      case 'yml':
      case 'toml':
        return <Braces className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'md':
      case 'txt':
      case 'markdown':
        return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <File className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
  };

  return (
    <div className="flex items-center justify-between bg-[#0d0e11] border-b border-zinc-800/80 px-1 select-none overflow-x-auto no-scrollbar">
      {/* Tabs list */}
      <div className="flex items-center gap-1 min-w-0 py-1">
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;
          const fileName = tab.path.split('/').pop() || tab.path;

          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              title={tab.path}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-all border ${
                isActive
                  ? 'bg-zinc-900 text-zinc-100 border-zinc-700/80 shadow-sm font-semibold'
                  : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-900/50 hover:text-zinc-300'
              }`}
            >
              {getTabIcon(tab.path)}
              <span className="truncate max-w-[130px]">{fileName}</span>

              {tab.highlightLines && tab.highlightLines[0] > 0 && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  L{tab.highlightLines[0]}-{tab.highlightLines[1]}
                </span>
              )}

              {/* Close Tab Button */}
              <button
                onClick={(e) => onCloseTab(tab.path, e)}
                className="p-0.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors opacity-60 group-hover:opacity-100 ml-0.5"
                title="Close tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Close All Action */}
      {tabs.length > 2 && onCloseAll && (
        <button
          onClick={onCloseAll}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors shrink-0"
          title="Close all tabs"
        >
          Close All
        </button>
      )}
    </div>
  );
};
