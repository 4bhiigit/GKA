import { v4 as uuidv4 } from 'uuid';
import { CodeChunk } from '../types';

export class CodeChunker {
  private static readonly TARGET_CHUNK_SIZE = 1400; // ~350-400 tokens
  private static readonly CHUNK_OVERLAP = 200;      // ~50 tokens

  /**
   * Split a file's content into semantic, code-aware chunks with accurate line spans
   */
  public static chunkFile(
    repositoryId: string,
    filePath: string,
    content: string,
    language: string = 'text'
  ): CodeChunk[] {
    if (!content || content.trim().length === 0) {
      return [];
    }

    const lines = content.split('\n');
    const totalLines = lines.length;

    // For very small files (< 40 lines or < 1500 chars), return single chunk
    if (content.length <= this.TARGET_CHUNK_SIZE && totalLines <= 40) {
      return [
        {
          id: uuidv4(),
          repositoryId,
          filePath,
          startLine: 1,
          endLine: totalLines,
          content: content,
          language,
          tokenEstimate: Math.ceil(content.length / 4),
        },
      ];
    }

    const chunks: CodeChunk[] = [];
    let currentLineIndex = 0;

    while (currentLineIndex < totalLines) {
      let currentChunkLines: string[] = [];
      let currentLength = 0;
      let startLine = currentLineIndex + 1;
      let lineIdx = currentLineIndex;

      while (lineIdx < totalLines) {
        const line = lines[lineIdx];
        const lineLength = line.length + 1; // +1 for newline

        // If adding this line exceeds target and we already have content
        if (currentLength + lineLength > this.TARGET_CHUNK_SIZE && currentChunkLines.length > 5) {
          // Try to break at a clean semantic code boundary if possible
          if (this.isSemanticBoundary(line) || currentLength > this.TARGET_CHUNK_SIZE * 1.3) {
            break;
          }
        }

        currentChunkLines.push(line);
        currentLength += lineLength;
        lineIdx++;

        if (currentLength >= this.TARGET_CHUNK_SIZE * 1.5) {
          break;
        }
      }

      const endLine = Math.min(lineIdx, totalLines);
      const chunkText = currentChunkLines.join('\n');

      if (chunkText.trim().length > 0) {
        chunks.push({
          id: uuidv4(),
          repositoryId,
          filePath,
          startLine,
          endLine,
          content: chunkText,
          language,
          tokenEstimate: Math.ceil(chunkText.length / 4),
        });
      }

      if (lineIdx >= totalLines) {
        break;
      }

      // Calculate overlap line step
      let overlapChars = 0;
      let stepBackLines = 0;

      for (let back = lineIdx - 1; back >= currentLineIndex; back--) {
        overlapChars += lines[back].length + 1;
        stepBackLines++;
        if (overlapChars >= this.CHUNK_OVERLAP || stepBackLines >= 8) {
          break;
        }
      }

      // Advance line index with overlap
      const nextIndex = Math.max(currentLineIndex + 1, lineIdx - stepBackLines);
      currentLineIndex = nextIndex;
    }

    return chunks;
  }

  /**
   * Check if a line represents a high-level function, class, or section boundary
   */
  private static isSemanticBoundary(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return true; // empty line is a natural separator

    const boundaryPatterns = [
      /^(export\s+)?(default\s+)?(class|interface|type|enum|struct|trait)\s+/i,
      /^(export\s+)?(async\s+)?function\s+/i,
      /^(pub\s+)?(fn|impl)\s+/i,
      /^(def|async\s+def)\s+/i,
      /^(public|private|protected|static)\s+/i,
      /^func\s+/i,
      /^#\s+/i, // markdown h1
      /^##\s+/i, // markdown h2
      /^###\s+/i, // markdown h3
    ];

    return boundaryPatterns.some(pattern => pattern.test(trimmed));
  }
}
