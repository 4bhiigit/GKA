import { GitHubService } from './services/github';
import { CodeChunker } from './services/chunker';
import { EmbeddingService } from './services/embedding';
import { VectorStoreService } from './services/vectorStore';
import { LLMService } from './services/llm';
import { RAGService } from './services/rag';
import { prisma } from './db/prisma';

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING FULL SYSTEM TEST SUITE (0 TO PRODUCTION)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Database Connection & CRUD
  try {
    console.log('[TEST 1] Testing Prisma Database connection & operations...');
    await prisma.$connect();
    const testRepoId = `test_repo_${Date.now()}`;
    const createdRepo = await prisma.repository.create({
      data: {
        id: testRepoId,
        githubUrl: `https://github.com/test-org/test-repo-${Date.now()}`,
        owner: 'test-org',
        name: 'test-repo',
        status: 'pending',
        progress: 0,
      },
    });

    if (createdRepo && createdRepo.id === testRepoId) {
      console.log('  ✅ Repository record created successfully');
    } else {
      throw new Error('Created repo record mismatch');
    }

    // Cleanup test record
    await prisma.repository.delete({ where: { id: testRepoId } });
    console.log('  ✅ Repository record deleted successfully');
    console.log('  PASSED: Database Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: Database Test:', err.message);
    failed++;
  }

  // TEST 2: GitHub URL Parser
  try {
    console.log('[TEST 2] Testing GitHub URL Parser...');
    const url1 = 'https://github.com/torvalds/linux.git';
    const parsed1 = GitHubService.parseRepoUrl(url1);
    if (parsed1.owner !== 'torvalds' || parsed1.name !== 'linux') {
      throw new Error(`Parsed incorrectly: ${JSON.stringify(parsed1)}`);
    }

    const url2 = 'https://github.com/facebook/react/';
    const parsed2 = GitHubService.parseRepoUrl(url2);
    if (parsed2.owner !== 'facebook' || parsed2.name !== 'react') {
      throw new Error(`Parsed incorrectly: ${JSON.stringify(parsed2)}`);
    }

    console.log('  ✅ Successfully parsed multiple URL variations');
    console.log('  PASSED: GitHub URL Parser Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: GitHub URL Parser Test:', err.message);
    failed++;
  }

  // TEST 3: Code Chunker
  try {
    console.log('[TEST 3] Testing Code Chunker...');
    const sampleCode = `
import express from 'express';

export class UserController {
  public static async getUser(req, res) {
    const userId = req.params.id;
    return res.json({ id: userId, name: 'Alice' });
  }

  public static async createUser(req, res) {
    const { name, email } = req.body;
    return res.status(201).json({ name, email });
  }
}
`.trim();

    const chunks = CodeChunker.chunkFile('repo_123', 'src/controllers/user.ts', sampleCode, 'typescript');
    if (!chunks || chunks.length === 0) {
      throw new Error('Chunker produced no chunks');
    }
    if (!chunks[0].filePath || !chunks[0].content || chunks[0].startLine !== 1) {
      throw new Error('Chunk metadata is invalid');
    }

    console.log(`  ✅ Successfully chunked code into ${chunks.length} chunks with line ranges: ${chunks[0].startLine}-${chunks[0].endLine}`);
    console.log('  PASSED: Code Chunker Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: Code Chunker Test:', err.message);
    failed++;
  }

  // TEST 4: Embeddings & Vector Storage
  try {
    console.log('[TEST 4] Testing Embedding Generation & Vector Store...');
    await VectorStoreService.init();

    const sampleText = 'function calculateTotal(price: number, tax: number): number { return price * (1 + tax); }';
    const vector = await EmbeddingService.embedText(sampleText);

    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Embedding service returned empty vector');
    }
    console.log(`  ✅ Generated vector with ${vector.length} dimensions`);

    const testRepoId = `test_vec_${Date.now()}`;
    const testChunk = {
      id: `chunk_${Date.now()}`,
      repositoryId: testRepoId,
      filePath: 'src/calc.ts',
      startLine: 1,
      endLine: 5,
      content: sampleText,
      language: 'typescript',
      tokenEstimate: 20,
    };

    await VectorStoreService.upsertChunks(testRepoId, [testChunk], [vector]);
    console.log('  ✅ Upserted chunks to vector store');

    // Query search
    const searchResults = await VectorStoreService.search(testRepoId, vector, 2);
    if (!searchResults || searchResults.length === 0) {
      throw new Error('Vector search returned 0 results for exact match vector');
    }
    console.log(`  ✅ Vector search returned match with score: ${searchResults[0].score.toFixed(4)} (File: ${searchResults[0].filePath})`);

    // Cleanup
    await VectorStoreService.deleteRepositoryVectors(testRepoId);
    console.log('  ✅ Deleted test repository vectors');
    console.log('  PASSED: Embeddings & Vector Store Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: Embeddings & Vector Store Test:', err.message);
    failed++;
  }

  // TEST 5: LLM Inference & Streaming
  try {
    console.log('[TEST 5] Testing LLM Chat & Summary Generation...');
    const summary = await LLMService.generateSummary(
      'You are a concise test assistant.',
      'Explain in 5 words what GitHub Knowledge Assistant does.'
    );
    console.log(`  ✅ LLM generated response: "${summary.trim().slice(0, 100)}..."`);

    console.log('  Testing LLM Stream...');
    const stream = LLMService.streamChat([
      { role: 'system', content: 'You are a test assistant. Answer with 3 words.' },
      { role: 'user', content: 'Say hello world' },
    ]);

    let tokenCount = 0;
    let fullResponse = '';
    for await (const token of stream) {
      tokenCount++;
      fullResponse += token;
    }
    console.log(`  ✅ Stream received ${tokenCount} chunks: "${fullResponse.trim().slice(0, 80)}"`);
    console.log('  PASSED: LLM Inference Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: LLM Inference Test:', err.message);
    failed++;
  }

  // TEST 6: GitHub API Integration
  try {
    console.log('[TEST 6] Testing GitHub API Tree Fetching & File Content...');
    const metadata = await GitHubService.getRepoMetadata('octocat', 'Hello-World');
    console.log(`  ✅ Fetched repo metadata: ${metadata.owner}/${metadata.name} (Default branch: ${metadata.defaultBranch})`);

    const files = await GitHubService.fetchRepoTree('octocat', 'Hello-World', metadata.defaultBranch);
    console.log(`  ✅ Fetched repo tree: found ${files.length} files (e.g. ${files[0]?.path || 'none'})`);

    if (files.length > 0) {
      const content = await GitHubService.fetchFileContent('octocat', 'Hello-World', metadata.defaultBranch, files[0].path);
      console.log(`  ✅ Fetched file content for ${files[0].path} (${content.length} chars)`);
    }

    console.log('  PASSED: GitHub API Integration Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: GitHub API Integration Test:', err.message);
    failed++;
  }

  // TEST 7: RAG Grounded Query & Citations Test
  try {
    console.log('[TEST 7] Testing RAG Grounded Query & Line Citations...');
    const testRagRepoId = `test_rag_${Date.now()}`;
    const authCodeChunk = {
      id: `chunk_auth_${Date.now()}`,
      repositoryId: testRagRepoId,
      filePath: 'src/middleware/auth.ts',
      startLine: 10,
      endLine: 25,
      content: `export function verifyToken(req: any, res: any, next: any) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}`,
      language: 'typescript',
      tokenEstimate: 35,
    };

    const chunkVector = await EmbeddingService.embedText(authCodeChunk.content);
    await VectorStoreService.upsertChunks(testRagRepoId, [authCodeChunk], [chunkVector]);

    const ragResult = await RAGService.queryCodebase(
      testRagRepoId,
      'test-org/secure-app',
      'Where is verifyToken defined and how does it check authorization?'
    );

    if (!ragResult.citations || ragResult.citations.length === 0) {
      throw new Error('RAG query returned no citations');
    }

    console.log(`  ✅ RAG retrieved citation: [${ragResult.citations[0].filePath}:${ragResult.citations[0].startLine}-${ragResult.citations[0].endLine}]`);

    let fullAnswer = '';
    for await (const chunk of ragResult.stream) {
      fullAnswer += chunk;
    }
    console.log(`  ✅ RAG generated grounded response: "${fullAnswer.trim().slice(0, 100)}..."`);

    await VectorStoreService.deleteRepositoryVectors(testRagRepoId);
    console.log('  PASSED: RAG Grounded Query Test\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED: RAG Grounded Query Test:', err.message);
    failed++;
  }

  // Summary
  console.log('====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Unexpected runner error:', err);
  process.exit(1);
});

