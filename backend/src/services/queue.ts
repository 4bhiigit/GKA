import EventEmitter from 'events';
import { prisma } from '../db/prisma';
import { GitHubService } from './github';
import { CodeChunker } from './chunker';
import { EmbeddingService } from './embedding';
import { VectorStoreService } from './vectorStore';
import { LLMService } from './llm';
import { IngestionProgress, CodeChunk } from '../types';

export class IngestionQueue extends EventEmitter {
  private static instance: IngestionQueue;
  private activeJobs: Map<string, IngestionProgress> = new Map();

  public static getInstance(): IngestionQueue {
    if (!this.instance) {
      this.instance = new IngestionQueue();
    }
    return this.instance;
  }

  public getProgress(repositoryId: string): IngestionProgress | null {
    return this.activeJobs.get(repositoryId) || null;
  }

  /**
   * Enqueue repository for background ingestion
   */
  public async enqueue(
    repositoryId: string,
    owner: string,
    repo: string,
    branch: string,
    userAccessToken?: string
  ): Promise<void> {
    const initialProgress: IngestionProgress = {
      repositoryId,
      status: 'indexing',
      progress: 5,
      stage: 'Connecting to GitHub...',
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
    };
    this.activeJobs.set(repositoryId, initialProgress);
    this.emit('progress', initialProgress);

    setImmediate(() => {
      this.processRepository(repositoryId, owner, repo, branch, userAccessToken).catch(err => {
        console.error(`[IngestionQueue] Unhandled processing error for ${repositoryId}:`, err);
      });
    });
  }

  private async updateStage(
    repositoryId: string,
    stage: string,
    progress: number,
    totalFiles: number = 0,
    indexedFiles: number = 0,
    totalChunks: number = 0
  ) {
    const prog: IngestionProgress = {
      repositoryId,
      status: 'indexing',
      progress,
      stage,
      totalFiles,
      indexedFiles,
      totalChunks,
    };
    this.activeJobs.set(repositoryId, prog);
    this.emit('progress', prog);

    try {
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          status: 'indexing',
          progress,
          progressStage: stage,
          fileCount: totalFiles || undefined,
          chunkCount: totalChunks || undefined,
        },
      });
    } catch {}
  }

  private async processRepository(
    repositoryId: string,
    owner: string,
    repo: string,
    branch: string,
    userAccessToken?: string
  ): Promise<void> {
    try {
      console.log(`[Ingestion] Starting ingestion for ${owner}/${repo} (${branch})`);

      // 1. Fetch file tree
      await this.updateStage(repositoryId, 'Fetching repository tree from GitHub...', 10);
      const files = await GitHubService.fetchRepoTree(owner, repo, branch, userAccessToken);

      if (!files.length) {
        throw new Error('No supported code files found in repository.');
      }

      const totalFiles = files.length;
      console.log(`[Ingestion] Found ${totalFiles} code files to index for ${owner}/${repo}`);

      // Count languages
      const languageCounts: Record<string, number> = {};
      files.forEach(f => {
        const lang = f.language || 'other';
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      });

      const fileTreeHierarchy = GitHubService.buildFileTree(files);

      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          fileCount: totalFiles,
          languages: JSON.stringify(languageCounts),
          fileTree: JSON.stringify(fileTreeHierarchy),
        },
      });

      // 2. Fetch raw file contents in concurrent batches
      await this.updateStage(repositoryId, `Fetching contents of ${totalFiles} files...`, 25, totalFiles);

      const allChunks: CodeChunk[] = [];
      const batchSize = 6;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const filePromises = batch.map(async (file) => {
          const content = await GitHubService.fetchFileContent(owner, repo, branch, file.path, userAccessToken);
          if (content) {
            const chunks = CodeChunker.chunkFile(repositoryId, file.path, content, file.language);
            return chunks;
          }
          return [];
        });

        const batchResults = await Promise.all(filePromises);
        batchResults.forEach(chunks => allChunks.push(...chunks));

        const processed = Math.min(i + batchSize, totalFiles);
        const fetchProgress = 25 + Math.floor((processed / totalFiles) * 35);
        await this.updateStage(
          repositoryId,
          `Downloaded and chunked ${processed}/${totalFiles} files (${allChunks.length} chunks)...`,
          fetchProgress,
          totalFiles,
          processed,
          allChunks.length
        );
      }

      if (!allChunks.length) {
        throw new Error('Could not extract any valid code chunks from files.');
      }

      // 3. Batch generate embeddings
      await this.updateStage(
        repositoryId,
        `Generating embeddings for ${allChunks.length} code chunks...`,
        65,
        totalFiles,
        totalFiles,
        allChunks.length
      );

      const chunkTexts = allChunks.map(c => `File: ${c.filePath}\nLanguage: ${c.language}\n${c.content}`);
      const vectors = await EmbeddingService.embedBatch(chunkTexts);

      // 4. Store in vector database
      await this.updateStage(
        repositoryId,
        `Storing vectors into database index...`,
        85,
        totalFiles,
        totalFiles,
        allChunks.length
      );

      await VectorStoreService.upsertChunks(repositoryId, allChunks, vectors);

      // 5. Generate Architecture Summary
      await this.updateStage(
        repositoryId,
        `Synthesizing codebase architecture overview...`,
        95,
        totalFiles,
        totalFiles,
        allChunks.length
      );

      let summary = '';
      try {
        const sampleFileList = files.slice(0, 50).map(f => `- ${f.path}`).join('\n');
        summary = await LLMService.generateSummary(
          'You are a senior software architect. Analyze the provided file tree and generate a concise 3-paragraph architecture overview: 1) What this project is, 2) Core components/directories and their roles, 3) Key entrypoints and technologies used.',
          `Repository: ${owner}/${repo}\nLanguages: ${JSON.stringify(languageCounts)}\nFiles:\n${sampleFileList}`
        );
      } catch (err) {
        console.warn(`[Ingestion] Summary generation warning:`, err);
      }

      // 6. Complete ingestion
      await prisma.repository.update({
        where: { id: repositoryId },
        data: {
          status: 'ready',
          progress: 100,
          progressStage: 'Ready',
          chunkCount: allChunks.length,
          summary: summary || undefined,
        },
      });

      const finalProgress: IngestionProgress = {
        repositoryId,
        status: 'ready',
        progress: 100,
        stage: 'Ready to chat!',
        totalFiles,
        indexedFiles: totalFiles,
        totalChunks: allChunks.length,
      };
      this.activeJobs.set(repositoryId, finalProgress);
      this.emit('progress', finalProgress);

      console.log(`[Ingestion] Completed indexing for ${owner}/${repo}! (${allChunks.length} chunks)`);
    } catch (error: any) {
      console.error(`[Ingestion] Error indexing ${owner}/${repo}:`, error);

      const failedProgress: IngestionProgress = {
        repositoryId,
        status: 'failed',
        progress: 0,
        stage: 'Indexing failed',
        totalFiles: 0,
        indexedFiles: 0,
        totalChunks: 0,
        error: error.message,
      };
      this.activeJobs.set(repositoryId, failedProgress);
      this.emit('progress', failedProgress);

      try {
        await prisma.repository.update({
          where: { id: repositoryId },
          data: {
            status: 'failed',
            errorMessage: error.message || 'Indexing failed',
            progressStage: 'Failed',
          },
        });
      } catch {}
    }
  }
}
