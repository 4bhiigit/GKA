import { EmbeddingService } from './embedding';
import { VectorStoreService } from './vectorStore';
import { LLMService, ChatMessageParam } from './llm';
import { Citation, VectorSearchResult } from '../types';

export interface RAGQueryResult {
  stream: AsyncGenerator<string, void, unknown>;
  citations: Citation[];
  retrievedChunks: VectorSearchResult[];
}

export class RAGService {
  /**
   * Process user question using RAG against indexed repository
   */
  public static async queryCodebase(
    repositoryId: string,
    repoName: string,
    userMessage: string,
    chatHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    preferredProvider?: 'groq' | 'gemini'
  ): Promise<RAGQueryResult> {
    // 1. Generate query embedding
    const queryVector = await EmbeddingService.embedText(userMessage);

    // 2. Perform vector search in vector database (take top 4 high-relevance chunks to respect free-tier token caps)
    const topChunks = await VectorStoreService.search(repositoryId, queryVector, 4);

    // 3. Deduplicate and extract citations
    const citations: Citation[] = topChunks.map(chunk => ({
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      snippet: chunk.content.slice(0, 300),
    }));

    // 4. Construct compact grounded context (capped to stay safely below 4,000 tokens)
    let contextBlock = '';
    if (topChunks.length === 0) {
      contextBlock = 'No relevant code chunks found in the index for this repository.';
    } else {
      contextBlock = topChunks
        .map((c, idx) => {
          // Truncate overly large chunks to prevent rate limit 413
          const trimmedContent = c.content.length > 1000 ? c.content.slice(0, 1000) + '\n... [content truncated]' : c.content;
          return `### [Chunk ${idx + 1}] File: \`${c.filePath}\` (Lines ${c.startLine}-${c.endLine})\n\`\`\`${c.language || 'text'}\n${trimmedContent}\n\`\`\``;
        })
        .join('\n\n');
    }

    // 5. System instruction
    const systemPrompt = `You are GitHub Knowledge Assistant (GKA), an expert software engineer assistant for repository **${repoName}**.
Answer the developer's question directly based on the Code Context below.
Always cite the exact file path and line numbers when referencing code (e.g. \`[src/index.js:10-25]\`).
Be concise, clear, and helpful.

---
CODE CONTEXT:
${contextBlock}
---`;

    // 6. Build messages payload (keep only the last 2 conversation turns to save tokens)
    const messages: ChatMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    const recentHistory = chatHistory.slice(-2);
    for (const chat of recentHistory) {
      messages.push({
        role: chat.role,
        content: chat.content.slice(0, 500), // truncate history
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    // 7. Invoke streaming LLM
    const stream = LLMService.streamChat(messages, preferredProvider);

    return {
      stream,
      citations,
      retrievedChunks: topChunks,
    };
  }
}
