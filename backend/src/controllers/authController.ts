import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../db/prisma';
import { config } from '../config';

export class AuthController {
  /**
   * GET /api/auth/github
   * Initiate GitHub OAuth redirect
   */
  public static githubLogin(req: Request, res: Response): void {
    if (!config.githubClientId) {
      res.status(500).send('GITHUB_CLIENT_ID is not configured in .env');
      return;
    }

    const redirectUri = `${config.frontendUrl}/auth/callback`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.githubClientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=read:user,repo,user:email`;

    res.redirect(githubAuthUrl);
  }

  /**
   * POST /api/auth/github/exchange
   * Exchange OAuth temporary code for access token and upsert User
   */
  public static async githubExchange(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.body;

      if (!code) {
        res.status(400).json({ error: 'Authorization code is required' });
        return;
      }

      if (!config.githubClientId || !config.githubClientSecret) {
        res.status(500).json({ error: 'GitHub OAuth Client ID or Secret is not configured in backend .env' });
        return;
      }

      // 1. Exchange code for access token with GitHub API
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: config.githubClientId.trim(),
          client_secret: config.githubClientSecret.trim(),
          code: String(code).trim(),
        },
        {
          headers: {
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );

      const { access_token, error, error_description } = tokenResponse.data;

      if (error || !access_token) {
        console.error('[AuthController] Token exchange error from GitHub:', tokenResponse.data);
        res.status(400).json({ error: error_description || error || 'Failed to obtain access token from GitHub' });
        return;
      }

      // 2. Fetch authenticated GitHub user details
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${access_token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Knowledge-Assistant',
        },
        timeout: 10000,
      });

      const userData = userResponse.data;

      const avatar = userData.avatar_url || `https://github.com/${userData.login}.png`;

      // 3. Upsert user in database
      const user = await prisma.user.upsert({
        where: { githubId: String(userData.id) },
        update: {
          username: userData.login,
          name: userData.name || userData.login,
          avatarUrl: avatar,
          email: userData.email || undefined,
          accessToken: access_token,
        },
        create: {
          githubId: String(userData.id),
          username: userData.login,
          name: userData.name || userData.login,
          avatarUrl: avatar,
          email: userData.email || undefined,
          accessToken: access_token,
        },
      });

      res.json({
        user: {
          id: user.id,
          githubId: user.githubId,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl || `https://github.com/${user.username}.png`,
          email: user.email,
        },
        token: user.id,
      });
    } catch (err: any) {
      console.error('[AuthController] OAuth Exchange Error:', err.response?.data || err.message);
      res.status(500).json({ error: err.response?.data?.message || err.message || 'OAuth exchange failed' });
    }
  }

  /**
   * GET /api/auth/me
   * Get current authenticated user
   */
  public static async getMe(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userId = authHeader?.replace('Bearer ', '') || (req.query.userId as string);

      if (!userId) {
        res.status(401).json({ user: null });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          githubId: true,
          username: true,
          name: true,
          avatarUrl: true,
          email: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(401).json({ user: null });
        return;
      }

      res.json({
        user: {
          ...user,
          avatarUrl: user.avatarUrl || `https://github.com/${user.username}.png`,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/auth/user-repos
   * Fetch authenticated user's personal GitHub repositories for 1-click import
   */
  public static async getUserGitHubRepos(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userId = authHeader?.replace('Bearer ', '') || (req.query.userId as string);

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.accessToken) {
        res.status(401).json({ error: 'User session expired or invalid' });
        return;
      }

      const reposResponse = await axios.get(
        'https://api.github.com/user/repos?sort=updated&per_page=100&type=all',
        {
          headers: {
            Authorization: `token ${user.accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Knowledge-Assistant',
          },
          timeout: 15000,
        }
      );

      const repos = (reposResponse.data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        description: r.description,
        isPrivate: r.private,
        htmlUrl: r.html_url,
        defaultBranch: r.default_branch || 'main',
        language: r.language,
        stars: r.stargazers_count,
        updatedAt: r.updated_at,
      }));

      res.json({ repos });
    } catch (err: any) {
      console.error('[AuthController] getUserGitHubRepos error:', err.response?.data || err.message);
      res.status(500).json({ error: err.response?.data?.message || err.message || 'Failed to fetch user repositories' });
    }
  }
}
