'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Repository, ChatMessage, Citation } from '../lib/types';
import { streamChat, clearChatHistory } from '../lib/api';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Trash2,
  Download,
  FileCode,
  Check,
  Copy,
  Zap,
  ArrowDown,
  Layers,
  Terminal,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { CitationBadge } from './CitationBadge';

const renderTextWithCitations = (text: string, onCitationClick: (c: Citation) => void) => {
  const citationRegex = /\[([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+):(\d+)(?:-(\d+))?\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const filePath = match[1];
    const startLine = parseInt(match[2], 10);
    const endLine = match[3] ? parseInt(match[3], 10) : startLine;

    parts.push(
      <CitationBadge
        key={`cite_${match.index}_${filePath}`}
        filePath={filePath}
        startLine={startLine}
        endLine={endLine}
        onClick={onCitationClick}
      />
    );
    lastIndex = citationRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

interface ChatInterfaceProps {
  repository: Repository;
  initialMessages?: ChatMessage[];
  selectedProvider: 'groq' | 'gemini';
  onCitationClick: (citation: Citation) => void;
}

const QUICK_STARTERS = [
  { label: 'Architecture Overview', icon: Layers, prompt: 'Provide a comprehensive high-level architecture overview of this repository, its core modules, and entrypoints.' },
  { label: 'API & Key Routes', icon: Terminal, prompt: 'What are the main API endpoints, routes, or export functions in this codebase and how do they work?' },
  { label: 'Security & Edge Cases', icon: ShieldAlert, prompt: 'Review this codebase for potential security concerns, unhandled edge cases, or performance bottlenecks.' },
  { label: 'Getting Started Guide', icon: Compass, prompt: 'How does a developer get started with this repository? What dependencies and configs are required?' },
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  repository,
  initialMessages = [],
  selectedProvider,
  onCitationClick,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Adjust textarea height dynamically
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      createdAt: new Date().toISOString(),
    };

    const assistantId = `ast_${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sourceFiles: [],
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    if (!customPrompt) setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsStreaming(true);

    try {
      await streamChat(
        repository.id,
        userMessage.content,
        selectedProvider,
        // On Token
        (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },
        // On Citations
        (citations) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, sourceFiles: citations } : msg
            )
          );
        },
        // On Done
        () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, isStreaming: false } : msg
            )
          );
          setIsStreaming(false);
        },
        // On Error
        (errorMsg) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: msg.content + `\n\n⚠️ **Error**: ${errorMsg}`,
                    isStreaming: false,
                  }
                : msg
            )
          );
          setIsStreaming(false);
        }
      );
    } catch (err: any) {
      console.error('Chat stream error:', err);
      setIsStreaming(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear conversation history for this repository?')) return;
    try {
      await clearChatHistory(repository.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleExportMarkdown = () => {
    if (messages.length === 0) return;
    const mdContent = messages
      .map(
        (m) =>
          `### ${m.role === 'user' ? '👤 User' : '🤖 Assistant'} (${new Date(
            m.createdAt
          ).toLocaleTimeString()})\n\n${m.content}\n\n${
            m.sourceFiles && m.sourceFiles.length > 0
              ? `**Sources**:\n` +
                m.sourceFiles
                  .map((s) => `- \`${s.filePath}:${s.startLine}-${s.endLine}\``)
                  .join('\n') +
                '\n\n'
              : ''
          }---\n`
      )
      .join('\n');

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repository.name}-chat-export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMessageText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyCodeSnippet = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-black text-zinc-100 relative">
      {/* Top Utility Bar */}
      <div className="px-4 py-2 bg-[#09090b]/80 border-b border-zinc-800/80 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs text-zinc-400 font-mono">
            Provider: <strong className="text-zinc-200 uppercase">{selectedProvider}</strong>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-xs text-zinc-400 font-mono">
            Indexed: <strong className="text-zinc-200">{repository.fileCount} files</strong> ({repository.chunkCount} chunks)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="Export Chat to Markdown (.md)"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State & Interactive Starters */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6 py-12 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shadow-xl">
              <Bot className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">
                Chat with {repository.owner}/{repository.name}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md">
                Ask questions about code logic, architecture, bug hunting, or refactoring. Every answer is grounded with source citations.
              </p>
            </div>

            {/* Quick Starters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left pt-2">
              {QUICK_STARTERS.map((starter) => {
                const Icon = starter.icon;
                return (
                  <button
                    key={starter.label}
                    onClick={() => handleSend(starter.prompt)}
                    className="p-3 rounded-xl bg-zinc-900/70 hover:bg-zinc-800/90 border border-zinc-800/80 hover:border-zinc-600 transition-all text-left space-y-1 group active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 group-hover:text-white">
                      <Icon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                      <span>{starter.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 line-clamp-2 leading-relaxed">
                      {starter.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <div
              key={message.id || idx}
              className={`flex gap-3 max-w-3xl mx-auto ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`group relative rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[88%] sm:max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-zinc-100 text-black font-medium'
                    : 'bg-[#0c0c0e] text-zinc-200 border border-zinc-800/90 shadow-lg'
                }`}
              >
                {/* Copy Button on Message Hover */}
                <button
                  onClick={() => copyMessageText(message.content, idx)}
                  className="absolute top-2 right-2 p-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy message"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                {/* Content Renderer */}
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none space-y-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p({ children }) {
                          if (typeof children === 'string') {
                            return <p>{renderTextWithCitations(children, onCitationClick)}</p>;
                          }
                          if (Array.isArray(children)) {
                            return (
                              <p>
                                {children.map((child, cIdx) =>
                                  typeof child === 'string' ? (
                                    <React.Fragment key={cIdx}>
                                      {renderTextWithCitations(child, onCitationClick)}
                                    </React.Fragment>
                                  ) : (
                                    child
                                  )
                                )}
                              </p>
                            );
                          }
                          return <p>{children}</p>;
                        },
                        li({ children }) {
                          if (typeof children === 'string') {
                            return <li>{renderTextWithCitations(children, onCitationClick)}</li>;
                          }
                          if (Array.isArray(children)) {
                            return (
                              <li>
                                {children.map((child, cIdx) =>
                                  typeof child === 'string' ? (
                                    <React.Fragment key={cIdx}>
                                      {renderTextWithCitations(child, onCitationClick)}
                                    </React.Fragment>
                                  ) : (
                                    child
                                  )
                                )}
                              </li>
                            );
                          }
                          return <li>{children}</li>;
                        },
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          const codeId = `code_${Math.random()}`;

                          return !inline && match ? (
                            <div className="relative my-3 rounded-lg overflow-hidden border border-zinc-800 bg-black group/code">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
                                <span>{match[1].toUpperCase()}</span>
                                <button
                                  onClick={() => copyCodeSnippet(codeString, codeId)}
                                  className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                                >
                                  {copiedCodeId === codeId ? (
                                    <>
                                      <Check className="w-3 h-3 text-white" />
                                      <span className="text-[9px]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span className="text-[9px]">Copy Code</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-3 overflow-x-auto text-[11px] font-mono text-zinc-200 leading-relaxed">
                                <code>{children}</code>
                              </pre>
                            </div>
                          ) : (
                            <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-200" {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>

                    {/* Streaming token cursor */}
                    {message.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-white ml-1 animate-pulse align-middle" />
                    )}
                  </div>
                )}

                {/* Grounded Source Citations */}
                {message.sourceFiles && message.sourceFiles.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1 font-semibold">
                      <FileCode className="w-3 h-3 text-zinc-400" />
                      <span>Verified Citations ({message.sourceFiles.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {message.sourceFiles.map((citation, cIdx) => (
                        <CitationBadge
                          key={cIdx}
                          filePath={citation.filePath}
                          startLine={citation.startLine}
                          endLine={citation.endLine}
                          onClick={onCitationClick}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-black font-semibold text-xs shrink-0 mt-0.5 shadow-sm">
                  <UserIcon className="w-4 h-4 text-black" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Input Bar */}
      <div className="p-3 sm:p-4 bg-gradient-to-t from-black via-black to-transparent shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-3xl mx-auto relative rounded-xl bg-zinc-900 border border-zinc-800 focus-within:border-zinc-500 transition-all shadow-2xl overflow-hidden"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask anything about ${repository.name}... (Press Enter to send)`}
            className="w-full bg-transparent px-4 py-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-sans leading-relaxed max-h-[180px]"
            disabled={isStreaming}
          />

          <div className="px-3 py-1.5 bg-black/40 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500">
            <span className="font-mono hidden sm:inline">
              Shift + Enter for new line • Grounded in code index
            </span>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                input.trim() && !isStreaming
                  ? 'bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-md'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <span>Ask AI</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
