import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { GitHubService } from '../services/github';
import { IngestionQueue } from '../services/queue';
import { VectorStoreService } from '../services/vectorStore';
import { LLMService } from '../services/llm';

export class RepoController {
  /**
   * POST /api/repos/import
   * Ingest and start indexing a GitHub repository
   */
  public static async importRepo(req: Request, res: Response): Promise<void> {
    try {
      const { githubUrl, branch } = req.body;
      const authHeader = req.headers.authorization;
      const userId = authHeader?.replace('Bearer ', '') || (req.body.userId as string);

      if (!githubUrl || typeof githubUrl !== 'string') {
        res.status(400).json({ error: 'GitHub repository URL is required' });
        return;
      }

      // Check if user is logged in to fetch private repos
      let userToken: string | undefined = undefined;
      let validUserId: string | undefined = undefined;

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          userToken = user.accessToken;
          validUserId = user.id;
        }
      }

      // Parse owner and repo name
      const { owner, name: repoName } = GitHubService.parseRepoUrl(githubUrl);
      const normalizedUrl = `https://github.com/${owner}/${repoName}`.toLowerCase();

      // Check if already exists in DB
      let repo = await prisma.repository.findUnique({
        where: { githubUrl: normalizedUrl },
      });

      // If already ready, return it
      if (repo && repo.status === 'ready') {
        res.status(200).json({
          message: 'Repository already indexed and ready',
          repository: repo,
        });
        return;
      }

      // Fetch metadata from GitHub
      const metadata = await GitHubService.getRepoMetadata(owner, repoName, userToken);
      const targetBranch = branch || metadata.defaultBranch;

      if (!repo) {
        repo = await prisma.repository.create({
          data: {
            githubUrl: normalizedUrl,
            owner: metadata.owner,
            name: metadata.name,
            defaultBranch: targetBranch,
            description: metadata.description,
            isPrivate: metadata.isPrivate,
            userId: validUserId,
            status: 'pending',
            progress: 0,
            progressStage: 'Queued for indexing',
          },
        });
      } else {
        // Reset existing failed / pending record
        repo = await prisma.repository.update({
          where: { id: repo.id },
          data: {
            status: 'pending',
            progress: 0,
            progressStage: 'Queued for re-indexing',
            errorMessage: null,
            userId: validUserId || repo.userId,
            isPrivate: metadata.isPrivate,
          },
        });
      }

      // Enqueue non-blocking ingestion
      const queue = IngestionQueue.getInstance();
      await queue.enqueue(repo.id, metadata.owner, metadata.name, targetBranch, userToken);

      res.status(202).json({
        message: 'Repository ingestion started',
        repository: repo,
      });
    } catch (error: any) {
      console.error('[RepoController] importRepo error:', error);
      res.status(400).json({ error: error.message || 'Failed to import repository' });
    }
  }

  /**
   * GET /api/repos
   * List all repositories
   */
  public static async listRepos(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userId = authHeader?.replace('Bearer ', '') || (req.query.userId as string);

      const whereClause = userId
        ? { OR: [{ userId }, { userId: null }] }
        : {};

      const repos = await prisma.repository.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });
      res.json({ repositories: repos });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/repos/:id
   * Get single repository details
   */
  public static async getRepo(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const repo = await prisma.repository.findUnique({
        where: { id },
      });

      if (!repo) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      res.json({ repository: repo });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/repos/:id/status
   * Get real-time ingestion status
   */
  public static async getRepoStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const queue = IngestionQueue.getInstance();
      const liveProgress = queue.getProgress(id);

      if (liveProgress) {
        res.json({ progress: liveProgress });
        return;
      }

      const repo = await prisma.repository.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          progress: true,
          progressStage: true,
          fileCount: true,
          chunkCount: true,
          errorMessage: true,
        },
      });

      if (!repo) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      res.json({
        progress: {
          repositoryId: repo.id,
          status: repo.status,
          progress: repo.progress,
          stage: repo.progressStage,
          totalFiles: repo.fileCount,
          indexedFiles: repo.fileCount,
          totalChunks: repo.chunkCount,
          error: repo.errorMessage || undefined,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/repos/:id/status/stream
   * Server-Sent Events stream for live ingestion progress
   */
  public static getRepoStatusStream(req: Request, res: Response): void {
    const id = String(req.params.id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const queue = IngestionQueue.getInstance();

    const onProgress = (prog: any) => {
      if (prog.repositoryId === id) {
        res.write(`data: ${JSON.stringify(prog)}\n\n`);
        if (prog.status === 'ready' || prog.status === 'failed') {
          cleanup();
          res.end();
        }
      }
    };

    queue.on('progress', onProgress);

    const cleanup = () => {
      queue.off('progress', onProgress);
    };

    req.on('close', cleanup);
  }

  /**
   * GET /api/repos/:id/files
   * Get file tree hierarchy
   */
  public static async getRepoFiles(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const repo = await prisma.repository.findUnique({
        where: { id },
        select: { fileTree: true, name: true, owner: true },
      });

      if (!repo) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      const tree = repo.fileTree ? JSON.parse(repo.fileTree) : [];
      res.json({ files: tree });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/repos/:id/file
   * Fetch specific raw file content and metadata from GitHub
   */
  public static async getRepoFile(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const filePath = String(req.query.path || '');
      const refQuery = req.query.ref as string | undefined;

      if (!filePath) {
        res.status(400).json({ error: 'File path query parameter (?path=...) is required' });
        return;
      }

      const repo = await prisma.repository.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!repo) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      const branch = refQuery || repo.defaultBranch || 'main';
      const userToken = repo.user?.accessToken || undefined;

      try {
        const fileDetails = await GitHubService.fetchFileWithDetails(
          repo.owner,
          repo.name,
          branch,
          filePath,
          userToken
        );

        res.json(fileDetails);
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 404) {
          res.status(404).json({
            error: 'File not found. This file may have been moved, renamed, or deleted on GitHub.',
            code: 'FILE_NOT_FOUND',
          });
          return;
        }
        if (status === 403) {
          res.status(403).json({
            error: 'GitHub API rate limit exceeded or access forbidden.',
            code: 'RATE_LIMIT_OR_FORBIDDEN',
            resetAt: err.response?.headers?.['x-ratelimit-reset'],
          });
          return;
        }
        if (status === 401) {
          res.status(401).json({
            error: 'GitHub OAuth token has expired or is invalid. Please reconnect your GitHub account.',
            code: 'UNAUTHORIZED',
          });
          return;
        }

        res.status(500).json({ error: err.message || 'Failed to fetch file content from GitHub' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/repos/:id/summary
   * Trigger or retrieve architecture overview summary
   */
  public static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const repo = await prisma.repository.findUnique({
        where: { id },
      });

      if (!repo) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      if (repo.summary) {
        res.json({ summary: repo.summary });
        return;
      }

      const summary = await LLMService.generateSummary(
        'You are an expert software architect. Provide a high-level architecture overview and summary of this repository.',
        `Repository: ${repo.owner}/${repo.name}\nDescription: ${repo.description || 'None'}\nLanguages: ${repo.languages || '{}'}`
      );

      await prisma.repository.update({
        where: { id },
        data: { summary },
      });

      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/repos/:id
   * Delete repository, chat history and vector index
   */
  public static async deleteRepo(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);

      await VectorStoreService.deleteRepositoryVectors(id);

      await prisma.repository.delete({
        where: { id },
      });

      res.json({ message: 'Repository deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
