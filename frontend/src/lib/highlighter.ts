import { createHighlighter, type Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'html',
  'css',
  'json',
  'yaml',
  'markdown',
  'sql',
  'shell',
  'dockerfile',
] as const;

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
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    env: 'shell',
    dockerfile: 'dockerfile',
    prisma: 'typescript',
  };
  return map[ext] || 'text';
}

export async function getHighlighterInstance(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: SUPPORTED_LANGUAGES as unknown as string[],
    });
  }
  return highlighterPromise;
}

export interface HighlightedLine {
  lineNumber: number;
  html: string;
  isHighlighted: boolean;
}

/**
 * Highlights code and splits it into structured lines with line numbers and highlight markers
 */
export async function highlightCodeWithLines(
  code: string,
  lang: string,
  highlightRange?: [number, number]
): Promise<HighlightedLine[]> {
  try {
    const highlighter = await getHighlighterInstance();
    const loadedLangs = highlighter.getLoadedLanguages();
    const effectiveLang = loadedLangs.includes(lang) ? lang : 'text';

    const tokens = highlighter.codeToTokens(code, {
      lang: effectiveLang as any,
      theme: 'github-dark',
    });

    const lines: HighlightedLine[] = [];
    const [startLine, endLine] = highlightRange || [0, 0];

    tokens.tokens.forEach((tokenLine, index) => {
      const lineNumber = index + 1;
      const isHighlighted =
        startLine > 0 &&
        endLine > 0 &&
        lineNumber >= startLine &&
        lineNumber <= endLine;

      // Build styled HTML for this line
      let lineHtml = '';
      if (tokenLine.length === 0) {
        lineHtml = '&nbsp;';
      } else {
        tokenLine.forEach((token) => {
          const color = token.color || '#e1e4e8';
          const content = escapeHtml(token.content);
          lineHtml += `<span style="color: ${color}">${content}</span>`;
        });
      }

      lines.push({
        lineNumber,
        html: lineHtml,
        isHighlighted,
      });
    });

    return lines;
  } catch (error) {
    console.error('Highlighter error, using fallback:', error);
    // Plaintext fallback
    const rawLines = code.split('\n');
    const [startLine, endLine] = highlightRange || [0, 0];

    return rawLines.map((raw, idx) => {
      const lineNumber = idx + 1;
      return {
        lineNumber,
        html: escapeHtml(raw) || '&nbsp;',
        isHighlighted:
          startLine > 0 &&
          endLine > 0 &&
          lineNumber >= startLine &&
          lineNumber <= endLine,
      };
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
