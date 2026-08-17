import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { RAGService } from '../services/rag';

export class ChatController {
  /**
   * POST /api/chat
   * Stream codebase chat response via Server-Sent Events
   */
  public static async chat(req: Request, res: Response): Promise<void> {
    try {
      const { repositoryId, message, provider } = req.body;

      if (!repositoryId || !message) {
        res.status(400).json({ error: 'repositoryId and message are required' });
        return;
      }

      // Check repository exists and is ready
      const repo = await prisma.repository.findUnique({
        where: { id: String(repositoryId) },
      });

      if (!repo) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      if (repo.status !== 'ready') {
        res.status(400).json({
          error: `Repository is currently ${repo.status}. Please wait until indexing is complete.`,
        });
        return;
      }

      // Fetch recent chat history
      const previousChats = await prisma.chat.findMany({
        where: { repositoryId: String(repositoryId) },
        orderBy: { createdAt: 'asc' },
        take: 6,
      });

      const historyFormatted = previousChats.map(c => ({
        role: c.role as 'user' | 'assistant',
        content: c.content,
      }));

      // Save user message to database
      await prisma.chat.create({
        data: {
          repositoryId: String(repositoryId),
          role: 'user',
          content: message,
        },
      });

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Query RAG pipeline
      const ragResult = await RAGService.queryCodebase(
        String(repositoryId),
        `${repo.owner}/${repo.name}`,
        message,
        historyFormatted,
        provider
      );

      // Send citations metadata first
      res.write(`event: citations\ndata: ${JSON.stringify(ragResult.citations)}\n\n`);

      // Stream LLM tokens
      let fullAssistantReply = '';

      for await (const chunk of ragResult.stream) {
        fullAssistantReply += chunk;
        res.write(`event: token\ndata: ${JSON.stringify({ token: chunk })}\n\n`);
      }

      // Save assistant message with citations to database
      if (fullAssistantReply) {
        await prisma.chat.create({
          data: {
            repositoryId: String(repositoryId),
            role: 'assistant',
            content: fullAssistantReply,
            sourceFiles: JSON.stringify(ragResult.citations),
          },
        });
      }

      res.write(`event: done\ndata: {}\n\n`);
      res.end();
    } catch (error: any) {
      console.error('[ChatController] chat error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'RAG query failed' });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  }

  /**
   * GET /api/repos/:repositoryId/chats
   * Retrieve conversation history for a repository
   */
  public static async getChatHistory(req: Request, res: Response): Promise<void> {
    try {
      const repositoryId = String(req.params.repositoryId);

      const chats = await prisma.chat.findMany({
        where: { repositoryId },
        orderBy: { createdAt: 'asc' },
      });

      const parsedChats = chats.map(c => ({
        id: c.id,
        role: c.role,
        content: c.content,
        sourceFiles: c.sourceFiles ? JSON.parse(c.sourceFiles) : [],
        createdAt: c.createdAt,
      }));

      res.json({ chats: parsedChats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/repos/:repositoryId/chats
   * Clear chat history
   */
  public static async clearChatHistory(req: Request, res: Response): Promise<void> {
    try {
      const repositoryId = String(req.params.repositoryId);

      await prisma.chat.deleteMany({
        where: { repositoryId },
      });

      res.json({ message: 'Chat history cleared' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
