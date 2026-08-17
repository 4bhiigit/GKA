import { Router, Request, Response } from 'express';
import { RepoController } from '../controllers/repoController';
import { ChatController } from '../controllers/chatController';
import { AuthController } from '../controllers/authController';
import { config } from '../config';

const router = Router();

// Health Check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      vectorStoreType: config.vectorStoreType,
      defaultLlmProvider: config.defaultLlmProvider,
      embeddingProvider: config.embeddingProvider,
      groqConfigured: !!config.groqApiKey,
      geminiConfigured: !!config.geminiApiKey,
      githubTokenConfigured: !!config.githubToken,
      githubOAuthConfigured: !!(config.githubClientId && config.githubClientSecret),
    },
  });
});

// Authentication Routes
router.get('/auth/github', AuthController.githubLogin);
router.post('/auth/github/exchange', AuthController.githubExchange);
router.get('/auth/me', AuthController.getMe);
router.get('/auth/user-repos', AuthController.getUserGitHubRepos);

// Repository Management Routes
router.post('/repos/import', RepoController.importRepo);
router.get('/repos', RepoController.listRepos);
router.get('/repos/:id', RepoController.getRepo);
router.get('/repos/:id/status', RepoController.getRepoStatus);
router.get('/repos/:id/status/stream', RepoController.getRepoStatusStream);
router.get('/repos/:id/files', RepoController.getRepoFiles);
router.post('/repos/:id/summary', RepoController.getSummary);
router.delete('/repos/:id', RepoController.deleteRepo);

// Chat & RAG Routes
router.post('/chat', ChatController.chat);
router.get('/repos/:repositoryId/chats', ChatController.getChatHistory);
router.delete('/repos/:repositoryId/chats', ChatController.clearChatHistory);

export default router;
