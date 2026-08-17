import fs from 'fs';
import path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';
import { CodeChunk, VectorSearchResult } from '../types';

interface StoredVectorItem {
  id: string;
  repositoryId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  vector: number[];
}

export class VectorStoreService {
  private static qdrantClient: QdrantClient | null = null;
  private static readonly QDRANT_COLLECTION = 'gka_codebase_chunks';
  private static readonly STORAGE_DIR = path.resolve(__dirname, '../../.storage');

  /**
   * Initialize vector storage (creates local directory or Qdrant collection)
   */
  public static async init(): Promise<void> {
    if (config.vectorStoreType === 'qdrant') {
      try {
        this.qdrantClient = new QdrantClient({
          url: config.qdrantUrl,
          apiKey: config.qdrantApiKey || undefined,
        });

        // Ensure collection exists
        const collections = await this.qdrantClient.getCollections();
        const exists = collections.collections.some(c => c.name === this.QDRANT_COLLECTION);

        if (!exists) {
          await this.qdrantClient.createCollection(this.QDRANT_COLLECTION, {
            vectors: {
              size: 768,
              distance: 'Cosine',
            },
          });
          console.log(`[VectorStore] Created Qdrant collection "${this.QDRANT_COLLECTION}"`);
        }
      } catch (err: any) {
        console.warn(`[VectorStore] Qdrant connection failed (${err.message}). Falling back to embedded local vector store.`);
        config.vectorStoreType = 'embedded';
      }
    }

    // Ensure local storage directory exists for embedded mode
    if (!fs.existsSync(this.STORAGE_DIR)) {
      fs.mkdirSync(this.STORAGE_DIR, { recursive: true });
    }
  }

  /**
   * Upsert chunks and their vectors
   */
  public static async upsertChunks(
    repositoryId: string,
    chunks: CodeChunk[],
    vectors: number[][]
  ): Promise<void> {
    if (!chunks.length) return;

    if (config.vectorStoreType === 'qdrant' && this.qdrantClient) {
      try {
        const points = chunks.map((chunk, index) => ({
          id: chunk.id,
          vector: vectors[index],
          payload: {
            repositoryId: chunk.repositoryId,
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            content: chunk.content,
            language: chunk.language,
          },
        }));

        // Batch upload to Qdrant
        const batchSize = 50;
        for (let i = 0; i < points.length; i += batchSize) {
          await this.qdrantClient.upsert(this.QDRANT_COLLECTION, {
            wait: true,
            points: points.slice(i, i + batchSize),
          });
        }
        return;
      } catch (err: any) {
        console.warn(`[VectorStore] Qdrant upsert failed: ${err.message}. Using embedded local store.`);
      }
    }

    // Embedded Vector Storage implementation
    const repoFile = path.join(this.STORAGE_DIR, `repo_${repositoryId}.json`);
    let storedItems: StoredVectorItem[] = [];

    if (fs.existsSync(repoFile)) {
      try {
        const data = fs.readFileSync(repoFile, 'utf-8');
        storedItems = JSON.parse(data);
      } catch {
        storedItems = [];
      }
    }

    chunks.forEach((chunk, index) => {
      storedItems.push({
        id: chunk.id,
        repositoryId: chunk.repositoryId,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        language: chunk.language,
        vector: vectors[index],
      });
    });

    fs.writeFileSync(repoFile, JSON.stringify(storedItems), 'utf-8');
  }

  /**
   * Search for top-K most similar chunks for a given query vector
   */
  public static async search(
    repositoryId: string,
    queryVector: number[],
    topK: number = 6
  ): Promise<VectorSearchResult[]> {
    if (config.vectorStoreType === 'qdrant' && this.qdrantClient) {
      try {
        const clientAny = this.qdrantClient as any;
        const searchFn = clientAny.search ? clientAny.search.bind(this.qdrantClient) : clientAny.query?.bind(this.qdrantClient);
        if (searchFn) {
          const searchResult = await searchFn(this.QDRANT_COLLECTION, {
            vector: queryVector,
            filter: {
              must: [
                {
                  key: 'repositoryId',
                  match: { value: repositoryId },
                },
              ],
            },
            limit: topK,
          });

          return (searchResult || []).map((res: any) => ({
            id: String(res.id),
            repositoryId: (res.payload?.repositoryId as string) || repositoryId,
            filePath: (res.payload?.filePath as string) || '',
            startLine: Number(res.payload?.startLine) || 1,
            endLine: Number(res.payload?.endLine) || 1,
            content: (res.payload?.content as string) || '',
            language: (res.payload?.language as string) || 'text',
            score: res.score || 0,
          }));
        }
      } catch (err: any) {
        console.warn(`[VectorStore] Qdrant search error: ${err.message}. Trying embedded store.`);
      }
    }

    // Embedded Vector Search (Cosine Similarity)
    const repoFile = path.join(this.STORAGE_DIR, `repo_${repositoryId}.json`);
    if (!fs.existsSync(repoFile)) {
      return [];
    }

    try {
      const data = fs.readFileSync(repoFile, 'utf-8');
      const items: StoredVectorItem[] = JSON.parse(data);

      const scoredItems = items.map(item => {
        const score = this.calculateCosineSimilarity(queryVector, item.vector);
        return {
          id: item.id,
          repositoryId: item.repositoryId,
          filePath: item.filePath,
          startLine: item.startLine,
          endLine: item.endLine,
          content: item.content,
          language: item.language,
          score,
        };
      });

      scoredItems.sort((a, b) => b.score - a.score);
      return scoredItems.slice(0, topK);
    } catch (err) {
      return [];
    }
  }

  /**
   * Delete vector index for a repository
   */
  public static async deleteRepositoryVectors(repositoryId: string): Promise<void> {
    // Delete from Qdrant if active
    if (config.vectorStoreType === 'qdrant' && this.qdrantClient) {
      try {
        await this.qdrantClient.delete(this.QDRANT_COLLECTION, {
          filter: {
            must: [
              {
                key: 'repositoryId',
                match: { value: repositoryId },
              },
            ],
          },
        });
      } catch (err: any) {
        console.warn(`[VectorStore] Qdrant delete failed: ${err.message}`);
      }
    }

    // Delete local embedded file
    const repoFile = path.join(this.STORAGE_DIR, `repo_${repositoryId}.json`);
    if (fs.existsSync(repoFile)) {
      try {
        fs.unlinkSync(repoFile);
      } catch {}
    }
  }

  /**
   * Compute Cosine Similarity between two normalized vectors
   */
  private static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
