'use client';

import React, { useState } from 'react';
import { Repository, User } from '../lib/types';
import { GitBranch, Plus, Database, Zap, Sparkles, Command, Github, LogOut, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  repositories: Repository[];
  activeRepo: Repository | null;
  user: User | null;
  onSelectRepo: (repo: Repository) => void;
  onOpenImporter: () => void;
  selectedProvider: 'groq' | 'gemini';
  onChangeProvider: (provider: 'groq' | 'gemini') => void;
  onOpenArchitecture?: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  repositories,
  activeRepo,
  user,
  onSelectRepo,
  onOpenImporter,
  selectedProvider,
  onChangeProvider,
  onOpenArchitecture,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleGitHubLogin = () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/auth/github`;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-black/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm shadow-sm">
            GKA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">
                GitHub Assistant
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono">
                SaaS v2.0
              </span>
            </div>
          </div>
        </div>

        {/* Center: Repository Selector & Architecture */}
        <div className="flex items-center gap-2">
          {repositories.length > 0 && (
            <div className="relative flex items-center">
              <GitBranch className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
              <select
                id="active-repo-select"
                aria-label="Active Repository"
                className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer max-w-[180px] sm:max-w-[240px] truncate font-mono"
                value={activeRepo?.id || ''}
                onChange={(e) => {
                  const selected = repositories.find((r) => r.id === e.target.value);
                  if (selected) onSelectRepo(selected);
                }}
              >
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.owner}/{repo.name} {repo.isPrivate ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeRepo?.status === 'ready' && onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-300 transition-all"
              title="Architecture Overview"
            >
              <Database className="w-3 h-3 text-zinc-300" />
              <span>Architecture</span>
            </button>
          )}
        </div>

        {/* Right: Model Selector, Import Button, & GitHub Auth */}
        <div className="flex items-center gap-2.5">
          {/* Provider Toggle */}
          <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => onChangeProvider('groq')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                selectedProvider === 'groq'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Groq (Ultra-Fast 120B Model)"
            >
              <Zap className="w-3 h-3" />
              <span>Groq</span>
            </button>
            <button
              onClick={() => onChangeProvider('gemini')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                selectedProvider === 'gemini'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Google Gemini Flash"
            >
              <Sparkles className="w-3 h-3" />
              <span>Gemini</span>
            </button>
          </div>

          {/* Import Button */}
          <button
            onClick={onOpenImporter}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-zinc-200 text-black transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-black" />
            <span className="hidden sm:inline">Import</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-0.5 px-1 py-0.2 text-[9px] bg-zinc-200 text-zinc-800 rounded">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>

          {/* User GitHub Profile / Login Button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-900 border border-zinc-800 transition-colors"
              >
                <img
                  src={user.avatarUrl || `https://github.com/${user.username}.png`}
                  alt={user.username}
                  className="w-5 h-5 rounded-full border border-zinc-700 object-cover bg-zinc-800"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes(`github.com/${user.username}.png`)) {
                      target.src = `https://github.com/${user.username}.png`;
                    }
                  }}
                />
                <span className="text-xs font-medium text-zinc-200 hidden md:inline max-w-[100px] truncate">
                  {user.username}
                </span>
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-xs font-semibold text-white truncate">{user.name || user.username}</p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate">@{user.username}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleGitHubLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all shadow-sm"
              title="Sign in with GitHub for 1-click private repos"
            >
              <Github className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Sign in with GitHub</span>
              <span className="sm:hidden">Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
