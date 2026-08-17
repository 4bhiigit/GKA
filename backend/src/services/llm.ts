import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Active Groq models in priority order
const GROQ_MODELS_FALLBACK = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'deepseek-r1-distill-llama-70b',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

export class LLMService {
  private static groqClient: Groq | null = null;
  private static geminiClient: GoogleGenerativeAI | null = null;

  private static getGroq(): Groq | null {
    if (!this.groqClient && config.groqApiKey) {
      this.groqClient = new Groq({ apiKey: config.groqApiKey });
    }
    return this.groqClient;
  }

  private static getGemini(): GoogleGenerativeAI | null {
    if (!this.geminiClient && config.geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
    }
    return this.geminiClient;
  }

  /**
   * Stream LLM response tokens as an AsyncIterable
   */
  public static async *streamChat(
    messages: ChatMessageParam[],
    preferredProvider?: 'groq' | 'gemini'
  ): AsyncGenerator<string, void, unknown> {
    const provider = preferredProvider || config.defaultLlmProvider;
    const groq = this.getGroq();
    const gemini = this.getGemini();

    // 1. Try Groq (Primary ultra-fast inference)
    if (groq) {
      const modelsToTry = [
        config.groqModel || 'openai/gpt-oss-120b',
        ...GROQ_MODELS_FALLBACK,
      ];
      // Deduplicate
      const uniqueModels = Array.from(new Set(modelsToTry));

      for (const modelName of uniqueModels) {
        try {
          const stream = await groq.chat.completions.create({
            model: modelName,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            temperature: 0.2,
            max_tokens: 3000,
            stream: true,
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) yield delta;
          }
          return;
        } catch (err: any) {
          console.warn(`[LLMService] Groq model ${modelName} error: ${err.message}. Trying next model...`);
        }
      }
    }

    // 2. Try Gemini
    if (gemini) {
      const geminiModels = [config.geminiModel, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
      for (const modelName of geminiModels) {
        try {
          const model = genModel(gemini, modelName);
          const systemMessage = messages.find(m => m.role === 'system')?.content || '';
          const conversationHistory = messages
            .filter(m => m.role !== 'system')
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n');

          const prompt = `${systemMessage ? `System Instructions:\n${systemMessage}\n\n` : ''}${conversationHistory}`;
          const result = await model.generateContentStream(prompt);

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) yield text;
          }
          return;
        } catch (err: any) {
          console.warn(`[LLMService] Gemini model ${modelName} stream error: ${err.message}`);
        }
      }
    }

    // 3. Fallback
    yield `⚠️ **Notice**: Unable to reach AI inference provider. Please ensure your **GROQ_API_KEY** is active in \`.env\`.\n\nRetrieved context for query:\n\n${messages[messages.length - 1]?.content || ''}`;
  }

  /**
   * One-shot non-streaming completion (used for summaries)
   */
  public static async generateSummary(systemPrompt: string, content: string): Promise<string> {
    const groq = this.getGroq();
    const gemini = this.getGemini();

    if (groq) {
      const modelsToTry = [config.groqModel || 'openai/gpt-oss-120b', ...GROQ_MODELS_FALLBACK];
      const uniqueModels = Array.from(new Set(modelsToTry));

      for (const modelName of uniqueModels) {
        try {
          const res = await groq.chat.completions.create({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content },
            ],
            temperature: 0.3,
            max_tokens: 1500,
          });
          return res.choices[0]?.message?.content || '';
        } catch {}
      }
    }

    if (gemini) {
      try {
        const model = gemini.getGenerativeModel({ model: config.geminiModel });
        const res = await model.generateContent(`${systemPrompt}\n\nUser Input:\n${content}`);
        return res.response.text();
      } catch (err: any) {
        console.warn(`[LLMService] Gemini summary error: ${err.message}`);
      }
    }

    return 'Summary generation unavailable. Please check LLM API credentials.';
  }
}

function genModel(gemini: GoogleGenerativeAI, modelName: string) {
  return gemini.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 3000,
    },
  });
}
