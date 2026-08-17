import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-docker';

export function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    less: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    env: 'bash',
    dockerfile: 'docker',
    prisma: 'typescript',
  };
  return map[ext] || 'text';
}

export interface HighlightedLine {
  lineNumber: number;
  html: string;
  isHighlighted: boolean;
}

/**
 * Ultra-fast synchronous code highlighter with line numbers and highlighted line markers (0ms latency)
 */
export async function highlightCodeWithLines(
  code: string,
  lang: string,
  highlightRange?: [number, number]
): Promise<HighlightedLine[]> {
  const rawLines = code.split('\n');
  const [startLine, endLine] = highlightRange || [0, 0];
  const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.markup;

  return rawLines.map((rawLine, idx) => {
    const lineNumber = idx + 1;
    const isHighlighted =
      startLine > 0 &&
      endLine > 0 &&
      lineNumber >= startLine &&
      lineNumber <= endLine;

    let lineHtml = '';
    if (!rawLine) {
      lineHtml = '&nbsp;';
    } else {
      try {
        lineHtml = Prism.highlight(rawLine, grammar, lang);
      } catch {
        lineHtml = escapeHtml(rawLine);
      }
    }

    return {
      lineNumber,
      html: lineHtml || '&nbsp;',
      isHighlighted,
    };
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
