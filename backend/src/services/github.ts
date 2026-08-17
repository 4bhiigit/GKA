import axios from 'axios';
import { config } from '../config';
import { RepoFile } from '../types';

export interface GitHubRepoMetadata {
  owner: string;
  name: string;
  defaultBranch: string;
  description: string;
  language: string;
  stars: number;
  isPrivate: boolean;
}

// Set of allowed programming & configuration file extensions
const ALLOWED_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'py', 'pyw',
  'java', 'kt', 'kts', 'scala',
  'go',
  'rs',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  'cs',
  'php',
  'rb',
  'swift',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'vue', 'svelte',
  'json', 'yaml', 'yml', 'toml', 'env',
  'md', 'markdown', 'mdx', 'txt',
  'sql', 'prisma',
  'sh', 'bash', 'zsh', 'bat', 'ps1',
  'dockerfile', 'makefile', 'graphql', 'proto',
  'readme', 'license', 'contributing', 'changelog',
]);

// Directories and file patterns to ignore
const IGNORED_PATHS = [
  'node_modules/', '.git/', '.github/', 'dist/', 'build/', '.next/', 'out/',
  'coverage/', '.nyc_output/', '__pycache__/', '.pytest_cache/', 'venv/', '.venv/',
  'env/', '.idea/', '.vscode/', 'target/', 'bin/', 'obj/', 'vendor/', '.turbo/',
  'packages/*/node_modules/', '.cache/'
];

const IGNORED_EXACT_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'cargo.lock', 'gemfile.lock', 'poetry.lock', 'composer.lock',
  'ds_store', '.ds_store', 'thumbs.db'
]);

export class GitHubService {
  private static getHeaders(customToken?: string) {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Knowledge-Assistant',
    };
    const token = customToken || config.githubToken;
    if (token) {
      headers['Authorization'] = token.startsWith('gh') ? `token ${token}` : `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Parse owner and repository name from various GitHub URL formats
   */
  public static parseRepoUrl(url: string): { owner: string; name: string } {
    try {
      const cleanUrl = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
      if (!match) {
        throw new Error('Invalid GitHub repository URL. Format: https://github.com/owner/repo');
      }
      return {
        owner: match[1],
        name: match[2].split('/')[0],
      };
    } catch {
      throw new Error('Invalid GitHub repository URL format. Example: https://github.com/owner/repo');
    }
  }

  /**
   * Fetch repository metadata (default branch, description, etc.)
   */
  public static async getRepoMetadata(owner: string, repo: string, customToken?: string): Promise<GitHubRepoMetadata> {
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: this.getHeaders(customToken),
        timeout: 15000,
      });

      return {
        owner: response.data.owner.login,
        name: response.data.name,
        defaultBranch: response.data.default_branch || 'main',
        description: response.data.description || '',
        language: response.data.language || 'Codebase',
        stars: response.data.stargazers_count || 0,
        isPrivate: !!response.data.private,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or is private (login with GitHub to access private repos).`);
      }
      if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
        throw new Error('GitHub API rate limit exceeded. Please sign in with GitHub.');
      }
      throw new Error(`Failed to fetch repo metadata: ${error.message}`);
    }
  }

  /**
   * Fetch the full recursive file tree of the repository
   */
  public static async fetchRepoTree(owner: string, repo: string, branch: string, customToken?: string): Promise<RepoFile[]> {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        {
          headers: this.getHeaders(customToken),
          timeout: 25000,
        }
      );

      if (!response.data.tree || !Array.isArray(response.data.tree)) {
        throw new Error('Invalid tree response from GitHub API');
      }

      const allItems: any[] = response.data.tree;
      const filteredFiles: RepoFile[] = [];

      for (const item of allItems) {
        if (item.type !== 'blob') continue;

        const filePath: string = item.path;
        const normalizedPath = filePath.toLowerCase();

        // Check if file is in an ignored directory
        if (IGNORED_PATHS.some(ignored => normalizedPath.includes(ignored))) {
          continue;
        }

        // Check exact filename ignore
        const fileName = normalizedPath.split('/').pop() || '';
        if (IGNORED_EXACT_FILES.has(fileName)) {
          continue;
        }

        // Check minified files
        if (normalizedPath.endsWith('.min.js') || normalizedPath.endsWith('.min.css')) {
          continue;
        }

        // Check extension
        const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : fileName;
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          continue;
        }

        // Check file size cap
        if (item.size && item.size > config.maxFileSizeBytes) {
          continue;
        }

        filteredFiles.push({
          path: filePath,
          size: item.size || 0,
          type: 'blob',
          sha: item.sha,
          url: item.url,
          language: ext,
        });

        if (filteredFiles.length >= config.maxFilesPerRepo) {
          break;
        }
      }

      return filteredFiles;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Failed to fetch tree for branch "${branch}". Verify repository exists.`);
      }
      throw new Error(`GitHub tree fetch error: ${error.message}`);
    }
  }

  /**
   * Fetch raw content of a specific file from GitHub with retry
   */
  public static async fetchFileContent(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    customToken?: string
  ): Promise<string> {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(rawUrl, {
          headers: this.getHeaders(customToken),
          responseType: 'text',
          transformResponse: [(data) => data],
          timeout: 10000,
        });
        return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      } catch (err: any) {
        if (attempt === maxRetries) {
          try {
            const apiRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
              headers: this.getHeaders(customToken),
              timeout: 10000,
            });
            if (apiRes.data && apiRes.data.content && apiRes.data.encoding === 'base64') {
              return Buffer.from(apiRes.data.content, 'base64').toString('utf-8');
            }
          } catch {
            return '';
          }
          return '';
        }
        await new Promise(resolve => setTimeout(resolve, 400 * attempt));
      }
    }
    return '';
  }

  /**
   * Helper to build a clean JSON file tree hierarchy for frontend UI
   */
  public static buildFileTree(files: RepoFile[]): any[] {
    const root: any[] = [];

    files.forEach((file) => {
      const parts = file.path.split('/');
      let currentLevel = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        let existingPath = currentLevel.find((item: any) => item.name === part);

        if (!existingPath) {
          existingPath = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            type: isFile ? 'file' : 'directory',
            size: isFile ? file.size : undefined,
            children: isFile ? undefined : [],
          };
          currentLevel.push(existingPath);
        }

        if (!isFile) {
          currentLevel = existingPath.children;
        }
      });
    });

    return root;
  }
}
