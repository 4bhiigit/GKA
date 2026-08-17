'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { RepoImporter } from '../components/RepoImporter';
import { RepoList } from '../components/RepoList';
import { ChatInterface } from '../components/ChatInterface';
import { FileTreeExplorer } from '../components/FileTreeExplorer';
import { ArchitectureModal } from '../components/ArchitectureModal';
import { CodeViewer } from '../components/CodeViewer/CodeViewer';
import { CodeViewerTabs, CodeTab } from '../components/CodeViewer/CodeViewerTabs';
import { Repository, Citation, FileNode, ChatMessage, User } from '../lib/types';
import { fetchRepos, fetchRepoFiles, fetchChatHistory, deleteRepository, fetchCurrentUser } from '../lib/api';
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Github,
  Lock,
  Zap,
  Database,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Terminal,
  Code2,
  ChevronLeft,
  X,
} from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [activeRepo, setActiveRepo] = useState<Repository | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('dashboard');

  const [files, setFiles] = useState<FileNode[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const [selectedProvider, setSelectedProvider] = useState<'groq' | 'gemini'>('groq');
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // In-App Code Viewer & Multi-File Tabs State
  const [codeTabs, setCodeTabs] = useState<CodeTab[]>([]);
  const [activeCodeTabPath, setActiveCodeTabPath] = useState<string | null>(null);
  const [isCodeViewerExpanded, setIsCodeViewerExpanded] = useState(false);
  const [isMobileCodeViewerOpen, setIsMobileCodeViewerOpen] = useState(false);

  // Open file in Code Viewer (with optional line range highlight)
  const openFileInCodeViewer = (filePath: string, highlightLines?: [number, number]) => {
    setCodeTabs((prev) => {
      const existingIndex = prev.findIndex((t) => t.path === filePath);
      if (existingIndex !== -1) {
        const updated = [...prev];
        if (highlightLines) {
          updated[existingIndex] = { ...updated[existingIndex], highlightLines };
        }
        return updated;
      }
      // Cap at 8 tabs by removing the oldest inactive tab
      const nextTabs = prev.length >= 8 ? prev.slice(1) : prev;
      return [...nextTabs, { path: filePath, highlightLines }];
    });
    setActiveCodeTabPath(filePath);

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileCodeViewerOpen(true);
    }
  };

  const handleCloseTab = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCodeTabs((prev) => {
      const updated = prev.filter((t) => t.path !== filePath);
      if (activeCodeTabPath === filePath) {
        const nextActive = updated.length > 0 ? updated[updated.length - 1].path : null;
        setActiveCodeTabPath(nextActive);
        if (!nextActive) {
          setIsMobileCodeViewerOpen(false);
        }
      }
      return updated;
    });
  };

  const handleCloseAllTabs = () => {
    setCodeTabs([]);
    setActiveCodeTabPath(null);
    setIsMobileCodeViewerOpen(false);
  };

  const activeCodeTab = codeTabs.find((t) => t.path === activeCodeTabPath) || null;

  // Check login on mount (non-blocking)
  useEffect(() => {
    try {
      const savedUserId = localStorage.getItem('gka_user_id');
      if (savedUserId) {
        fetchCurrentUser(savedUserId).then((currentUser) => {
          if (currentUser) {
            setUser(currentUser);
            loadRepositories(currentUser.id);
          } else {
            localStorage.removeItem('gka_user_id');
            localStorage.removeItem('gka_user');
            setUser(null);
          }
        });
      }
    } catch (err) {
      console.warn('Auth check error:', err);
    }
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K to open importer (only when logged in)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (user) {
          setIsImporterOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  const loadRepositories = async (userId?: string) => {
    try {
      const repos = await fetchRepos(userId);
      setRepositories(repos);

      if (!activeRepo && repos.length > 0) {
        const readyRepo = repos.find((r) => r.status === 'ready') || repos[0];
        if (readyRepo) {
          handleSelectRepo(readyRepo);
        }
      }
    } catch (err) {
      console.error('Failed to load repos:', err);
    }
  };

  const handleSelectRepo = async (repo: Repository) => {
    setActiveRepo(repo);
    setActiveTab('chat');

    try {
      const [repoFiles, chats] = await Promise.all([
        fetchRepoFiles(repo.id).catch(() => []),
        fetchChatHistory(repo.id).catch(() => []),
      ]);
      setFiles(repoFiles);
      setChatHistory(chats);
    } catch (err) {
      console.error('Failed to load repo files/chat:', err);
    }
  };

  const handleDeleteRepo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this repository index and chat history?')) {
      return;
    }

    try {
      await deleteRepository(id);
      setRepositories((prev) => prev.filter((r) => r.id !== id));
      if (activeRepo?.id === id) {
        setActiveRepo(null);
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error('Failed to delete repository:', err);
      alert('Failed to delete repository.');
    }
  };

  const handleImportSuccess = (newRepo: Repository) => {
    setIsImporterOpen(false);
    setRepositories((prev) => [newRepo, ...prev.filter((r) => r.id !== newRepo.id)]);
    handleSelectRepo(newRepo);
  };

  const handleLogout = () => {
    localStorage.removeItem('gka_user_id');
    localStorage.removeItem('gka_user');
    setUser(null);
    setRepositories([]);
    setActiveRepo(null);
  };

  const handleGitHubLogin = () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/auth/github`;
  };

  // 1. Auth Gate / Login Screen (When user is not logged in)
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col selection:bg-zinc-800 selection:text-white bg-grid-pattern bg-radial-gradient">
        {/* Minimal Auth Header */}
        <header className="w-full border-b border-zinc-800/80 bg-black/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm shadow-sm">
              GKA
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">
              GitHub Knowledge Assistant
            </span>
          </div>

          <button
            onClick={handleGitHubLogin}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-md"
          >
            <Github className="w-4 h-4" />
            <span>Sign in with GitHub</span>
          </button>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-5xl mx-auto text-center space-y-8 animate-fade-in my-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
            <span>Authentication Required • Private & Public Codebases</span>
          </div>

          {/* Title */}
          <div className="space-y-3 max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Chat with your Codebase. <br />
              <span className="text-zinc-400 font-normal">Grounded in exact code lines.</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Sign in with your GitHub account to index your private and public repositories with ultra-fast LLM inference and verified line citations.
            </p>
          </div>

          {/* Main Sign in Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              onClick={handleGitHubLogin}
              className="flex items-center gap-3 px-7 py-3.5 text-sm font-semibold rounded-xl bg-white hover:bg-zinc-200 text-black transition-all active:scale-95 shadow-xl hover:shadow-2xl animate-glow"
            >
              <Github className="w-5 h-5" />
              <span>Continue with GitHub</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Live Demo Preview Card */}
          <div className="w-full max-w-2xl rounded-2xl bg-[#09090b]/90 border border-zinc-800 text-left p-5 shadow-2xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-mono text-zinc-300">Live Code Query Simulation</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                GKA Assistant
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="text-zinc-500 font-mono">Query:</span>
                <span className="text-zinc-200 font-medium">"Where is the user authentication middleware defined?"</span>
              </div>
              <div className="p-3 rounded-lg bg-black border border-zinc-800/80 space-y-2 text-zinc-300">
                <p className="text-xs leading-relaxed">
                  User authentication is handled in <code className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono">src/middleware/auth.ts</code> via the <code className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono">verifyToken()</code> middleware.
                </p>
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/50">
                  <FileCode className="w-3 h-3 text-zinc-400" />
                  <span className="text-[10px] font-mono text-zinc-400">
                    Citations: <strong className="text-zinc-200">[src/middleware/auth.ts:14-38]</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Value Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-4 text-left">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-white">Private & Public Repos</h3>
              <p className="text-[11px] text-zinc-400">
                1-click access to your GitHub repositories with personal OAuth tokens.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-white">Line-by-Line Citations</h3>
              <p className="text-[11px] text-zinc-400">
                Every AI answer is verified and linked to the exact source lines in your repo.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-white">Architecture Maps</h3>
              <p className="text-[11px] text-zinc-400">
                Interactive file tree explorer and high-level codebase architecture summaries.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-zinc-900 py-4 text-center text-xs text-zinc-600 font-mono">
          GitHub Knowledge Assistant • Secure Local Embedding & RAG System
        </footer>
      </div>
    );
  }

  // 2. Full App Experience (When User is Logged In)
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-zinc-100">
      {/* Top Navigation */}
      <Navbar
        repositories={repositories}
        activeRepo={activeRepo}
        user={user}
        onSelectRepo={handleSelectRepo}
        onOpenImporter={() => setIsImporterOpen(true)}
        selectedProvider={selectedProvider}
        onChangeProvider={setSelectedProvider}
        onOpenArchitecture={() => setIsArchModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Workspace Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'dashboard' || !activeRepo ? (
          /* Dashboard View */
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto w-full">
            <RepoList
              repositories={repositories}
              onSelectRepo={handleSelectRepo}
              onDeleteRepo={handleDeleteRepo}
              onOpenImporter={() => setIsImporterOpen(true)}
            />
          </main>
        ) : (
          /* Active Repository Split-View */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Sidebar: Repository File Tree (Collapsible) */}
            <div
              className={`transition-all duration-200 ease-in-out border-r border-zinc-800 z-20 shrink-0 ${
                isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-60 sm:w-64'
              }`}
            >
              <FileTreeExplorer
                files={files}
                onSelectFile={(filePath) => {
                  openFileInCodeViewer(filePath);
                }}
              />
            </div>

            {/* Center / Left Pane: Chat Interface */}
            <main
              className={`flex flex-col min-w-0 overflow-hidden relative transition-all duration-200 ${
                codeTabs.length > 0 && activeCodeTab && !isCodeViewerExpanded
                  ? 'w-full lg:w-1/2 flex-1 border-r border-zinc-800'
                  : isCodeViewerExpanded
                  ? 'hidden'
                  : 'flex-1'
              }`}
            >
              {/* Top Sub-Bar */}
              <div className="px-3.5 py-1.5 bg-[#09090b] border-b border-zinc-800 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {isSidebarCollapsed ? (
                      <PanelLeftOpen className="w-3.5 h-3.5" />
                    ) : (
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-zinc-400 text-[11px]">
                    Repo: <strong className="text-white">{activeRepo.name}</strong> ({activeRepo.defaultBranch})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mobile open code viewer button */}
                  {codeTabs.length > 0 && (
                    <button
                      onClick={() => {
                        if (activeCodeTabPath) {
                          setIsMobileCodeViewerOpen(true);
                        }
                      }}
                      className="flex lg:hidden items-center gap-1 px-2 py-0.5 rounded text-amber-300 bg-amber-500/10 border border-amber-500/20 text-[11px]"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>Code ({codeTabs.length})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-[11px]"
                  >
                    <LayoutDashboard className="w-3 h-3" />
                    <span>Dashboard</span>
                  </button>
                </div>
              </div>

              {/* Chat View */}
              <div className="flex-1 overflow-hidden">
                <ChatInterface
                  key={activeRepo.id}
                  repository={activeRepo}
                  initialMessages={chatHistory}
                  selectedProvider={selectedProvider}
                  onCitationClick={(citation) => {
                    openFileInCodeViewer(citation.filePath, [citation.startLine, citation.endLine]);
                  }}
                />
              </div>
            </main>

            {/* Right Pane: In-App Code Viewer (Desktop Split-Pane) */}
            {codeTabs.length > 0 && activeCodeTab && (
              <aside
                className={`hidden lg:flex flex-col overflow-hidden relative transition-all duration-200 ${
                  isCodeViewerExpanded ? 'flex-1 w-full' : 'w-1/2 flex-1'
                }`}
              >
                <CodeViewerTabs
                  tabs={codeTabs}
                  activeTabPath={activeCodeTabPath}
                  onSelectTab={(path) => setActiveCodeTabPath(path)}
                  onCloseTab={handleCloseTab}
                  onCloseAll={handleCloseAllTabs}
                />
                <div className="flex-1 overflow-hidden">
                  <CodeViewer
                    key={`${activeRepo.id}:${activeCodeTab.path}`}
                    repoId={activeRepo.id}
                    owner={activeRepo.owner}
                    repoName={activeRepo.name}
                    defaultBranch={activeRepo.defaultBranch}
                    filePath={activeCodeTab.path}
                    highlightLines={activeCodeTab.highlightLines}
                    githubUrl={activeRepo.githubUrl}
                    userId={user?.id}
                    onClose={() => handleCloseTab(activeCodeTab.path, { stopPropagation: () => {} } as any)}
                    isExpanded={isCodeViewerExpanded}
                    onToggleExpand={() => setIsCodeViewerExpanded(!isCodeViewerExpanded)}
                  />
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Mobile Full-Screen Code Viewer Modal */}
      {isMobileCodeViewerOpen && activeCodeTab && activeRepo && (
        <div className="fixed inset-0 z-50 bg-[#090a0f] flex flex-col lg:hidden animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border-b border-zinc-800 shrink-0">
            <button
              onClick={() => setIsMobileCodeViewerOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Chat</span>
            </button>

            <span className="text-xs font-mono text-zinc-400 truncate max-w-[160px]">
              {activeCodeTab.path.split('/').pop()}
            </span>

            <button
              onClick={() => setIsMobileCodeViewerOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <CodeViewerTabs
            tabs={codeTabs}
            activeTabPath={activeCodeTabPath}
            onSelectTab={(path) => setActiveCodeTabPath(path)}
            onCloseTab={handleCloseTab}
            onCloseAll={handleCloseAllTabs}
          />

          <div className="flex-1 overflow-hidden">
            <CodeViewer
              key={`mobile:${activeRepo.id}:${activeCodeTab.path}`}
              repoId={activeRepo.id}
              owner={activeRepo.owner}
              repoName={activeRepo.name}
              defaultBranch={activeRepo.defaultBranch}
              filePath={activeCodeTab.path}
              highlightLines={activeCodeTab.highlightLines}
              githubUrl={activeRepo.githubUrl}
              userId={user?.id}
              onClose={() => setIsMobileCodeViewerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Import Modal */}
      <RepoImporter
        isOpen={isImporterOpen}
        user={user}
        onClose={() => setIsImporterOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Architecture Summary Modal */}
      {activeRepo && (
        <ArchitectureModal
          isOpen={isArchModalOpen}
          onClose={() => setIsArchModalOpen(false)}
          repositoryId={activeRepo.id}
          repoName={`${activeRepo.owner}/${activeRepo.name}`}
          initialSummary={activeRepo.summary}
        />
      )}
    </div>
  );
}
