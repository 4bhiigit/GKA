'use client';

import React, { useState, useMemo } from 'react';
import { FileNode } from '../lib/types';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
  Code,
  Braces,
} from 'lucide-react';

interface FileTreeExplorerProps {
  files: FileNode[];
  onSelectFile?: (filePath: string) => void;
}

export const FileTreeExplorer: React.FC<FileTreeExplorerProps> = ({ files, onSelectFile }) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'src': true,
    'lib': true,
    'app': true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const toggleAllFolders = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);

    const newMap: Record<string, boolean> = {};
    const collect = (nodes: FileNode[]) => {
      nodes.forEach((n) => {
        if (n.type === 'directory') {
          newMap[n.path] = nextState;
          if (n.children) collect(n.children);
        }
      });
    };
    collect(files);
    setExpandedFolders(newMap);
  };

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();
    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .map((node) => {
          if (node.type === 'file') {
            return node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)
              ? node
              : null;
          }
          if (node.children) {
            const filteredChildren = filterNodes(node.children);
            if (filteredChildren.length > 0) {
              return { ...node, children: filteredChildren };
            }
          }
          return node.name.toLowerCase().includes(query) ? node : null;
        })
        .filter(Boolean) as FileNode[];
    };

    return filterNodes(files);
  }, [files, searchQuery]);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
      case 'go':
      case 'rs':
      case 'java':
        return <FileCode className="w-3.5 h-3.5 text-zinc-300 shrink-0" />;
      case 'json':
      case 'yaml':
      case 'yml':
      case 'toml':
        return <Braces className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      case 'md':
      case 'txt':
        return <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      default:
        return <Code className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
    }
  };

  const renderTree = (nodes: FileNode[], level: number = 0) => {
    return nodes.map((node) => {
      const isDir = node.type === 'directory';
      const isExpanded = isDir ? (searchQuery ? true : !!expandedFolders[node.path]) : false;

      return (
        <div key={node.path} className="select-none text-xs">
          <div
            onClick={() => {
              if (isDir) {
                toggleFolder(node.path);
              } else if (onSelectFile) {
                onSelectFile(node.path);
              }
            }}
            style={{ paddingLeft: `${Math.max(8, level * 14 + 8)}px` }}
            className={`flex items-center gap-1.5 py-1.5 pr-2 rounded-md cursor-pointer transition-all ${
              isDir
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 font-medium'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 font-mono text-[11px]'
            }`}
          >
            {isDir ? (
              <>
                <span className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </span>
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span className="truncate">{node.name}</span>
                {node.children && (
                  <span className="ml-auto text-[9px] text-zinc-600 font-mono">
                    {node.children.length}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="w-3.5" />
                {getFileIcon(node.name)}
                <span className="truncate">{node.name}</span>
                {node.size !== undefined && (
                  <span className="ml-auto text-[9px] text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    {(node.size / 1024).toFixed(0)}kb
                  </span>
                )}
              </>
            )}
          </div>

          {isDir && isExpanded && node.children && (
            <div className="relative">
              {/* Indentation visual guide line */}
              <div
                className="absolute top-0 bottom-0 border-l border-zinc-800/60 pointer-events-none"
                style={{ left: `${level * 14 + 14}px` }}
              />
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-black/95 text-zinc-200 select-none">
      {/* Header & Controls */}
      <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0 bg-[#09090b]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Explorer
            </span>
          </div>

          <button
            onClick={toggleAllFolders}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title={allExpanded ? 'Collapse All' : 'Expand All'}
          >
            {allExpanded ? (
              <ChevronsDownUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronsUpDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Live Filter Search Bar */}
        <div className="relative">
          <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-md pl-7 pr-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredFiles.length > 0 ? (
          renderTree(filteredFiles)
        ) : (
          <div className="p-4 text-center text-xs text-zinc-500">
            {searchQuery ? 'No matching files found' : 'No indexed files'}
          </div>
        )}
      </div>
    </div>
  );
};
