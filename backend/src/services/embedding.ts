import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

export class EmbeddingService {
  private static geminiClient: GoogleGenerativeAI | null = null;

  private static getGeminiClient(): GoogleGenerativeAI | null {
    if (!this.geminiClient && config.geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
    }
    return this.geminiClient;
  }

  /**
   * Generate an embedding vector for a single text string
   */
  public static async embedText(text: string): Promise<number[]> {
    const vectors = await this.embedBatch([text]);
    return vectors[0] || this.createLocalFallbackVector(text);
  }

  /**
   * Batch generate embeddings with rate limiting and fallback
   */
  public static async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const gemini = this.getGeminiClient();

    // If Gemini API Key is available, use Gemini text-embedding-004
    if (gemini && config.embeddingProvider === 'gemini') {
      try {
        const model = gemini.getGenerativeModel({ model: config.geminiEmbeddingModel });
        const results: number[][] = [];
        const batchSize = 15; // Safe batch size for free-tier rate limits

        for (let i = 0; i < texts.length; i += batchSize) {
          const chunkBatch = texts.slice(i, i + batchSize);
          const batchPromises = chunkBatch.map(async (text) => {
            const cleanText = text.slice(0, 8000); // Token safety limit
            const res = await model.embedContent(cleanText);
            return res.embedding.values;
          });

          const batchVectors = await Promise.all(batchPromises);
          results.push(...batchVectors);

          // Small delay between batches to avoid throttling
          if (i + batchSize < texts.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }

        return results;
      } catch (err: any) {
        console.warn(`[EmbeddingService] Gemini API embedding error: ${err.message}. Using high-dimension local fallback.`);
      }
    }

    // Fallback: Generate local normalized semantic feature vectors
    return texts.map(t => this.createLocalFallbackVector(t));
  }

  /**
   * High-dimensional deterministic local feature vector generator (Fallback when no API key)
   */
  public static createLocalFallbackVector(text: string, dimensions: number = 768): number[] {
    const vector = new Array(dimensions).fill(0);
    const normalized = text.toLowerCase();
    const words = normalized.split(/[^a-z0-9_]+/);

    // Bag-of-words + character n-grams hashing
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;

      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1.0 / Math.sqrt(words.length);
    }

    // N-gram features (length 3)
    for (let i = 0; i < normalized.length - 2; i++) {
      const ngram = normalized.slice(i, i + 3);
      let hash = 0;
      for (let j = 0; j < ngram.length; j++) {
        hash = (hash << 5) - hash + ngram.charCodeAt(j);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 0.5;
    }

    // Normalize vector (L2 norm)
    let sumSquares = 0;
    for (let i = 0; i < dimensions; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSquares) || 1;
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }

    return vector;
  }
}
