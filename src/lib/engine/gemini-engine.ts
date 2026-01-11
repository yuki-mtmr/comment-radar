/**
 * GeminiEngine - Real sentiment analysis using Google Gemini API
 *
 * This engine uses Gemini 2.0 Flash for fast, accurate sentiment analysis.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  YouTubeComment,
  SentimentAnalysis,
  SentimentScore,
  EmotionTag,
  BatchAnalysisRequest,
  BatchAnalysisResponse,
  AnalysisEngineConfig,
} from "@/types";
import type { AnalysisEngine } from "./types";
import { SYSTEM_PROMPT, createBatchPrompt, createSingleCommentPrompt } from "@/lib/llm/prompts";
import { AnalysisError } from "@/types";

const DEFAULT_CONFIG: AnalysisEngineConfig = {
  batchSize: 25, // Increased to reduce total request count (RPM bottleneck)
  maxComments: 500,
  timeoutMs: 30000,
};

const DEFAULT_MODEL = "gemini-2.0-flash";

interface GeminiResponse {
  id: number;
  commentId: string;
  score: number;
  emotions: string[];
  isSarcasm: boolean;
  reason: string;
}

export class GeminiEngine implements AnalysisEngine {
  readonly name = "GeminiEngine";
  private config: AnalysisEngineConfig;
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

  constructor(apiKey: string, config?: Partial<AnalysisEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  async analyzeComment(comment: YouTubeComment): Promise<SentimentAnalysis> {
    const prompt = createSingleCommentPrompt(comment);

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const parsed = this.parseJSON<GeminiResponse>(text);

      const weightedScore = this.calculateWeightedScore(parsed.score, comment.likeCount);

      return {
        commentId: comment.id,
        score: this.clampScore(parsed.score),
        weightedScore,
        emotions: parsed.emotions as EmotionTag[],
        isSarcasm: parsed.isSarcasm,
        reason: parsed.reason,
      };
    } catch (error) {
      throw new AnalysisError(
        `Failed to analyze comment: ${error instanceof Error ? error.message : "Unknown error"}`,
        "GEMINI_ERROR",
        error
      );
    }
  }

  async analyzeBatch(request: BatchAnalysisRequest): Promise<BatchAnalysisResponse> {
    const startTime = Date.now();

    if (request.comments.length === 0) {
      return {
        analyses: [],
        processingTimeMs: 0,
        tokensUsed: 0,
      };
    }

    const prompt = createBatchPrompt(request.comments, request.videoContext);

    // Simple retry logic for non-quota errors, or specific handling for 429
    let lastError: any;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Parse JSON response
        const parsedArray = this.parseJSON<GeminiResponse[]>(text);

        if (!Array.isArray(parsedArray)) {
          throw new Error("Expected JSON array response from Gemini");
        }

        // Map to SentimentAnalysis format
        const analyses: SentimentAnalysis[] = request.comments.map((comment) => {
          const item = parsedArray.find((p) => p.commentId === comment.id);

          if (!item) {
            return {
              commentId: comment.id,
              score: 0,
              weightedScore: 0,
              emotions: ["analytical"] as EmotionTag[],
              isSarcasm: false,
              reason: "Gemini skipped this comment in batch analysis",
            };
          }

          return {
            commentId: item.commentId,
            score: this.clampScore(item.score),
            weightedScore: this.calculateWeightedScore(item.score, comment.likeCount),
            emotions: item.emotions as EmotionTag[],
            isSarcasm: item.isSarcasm,
            reason: item.reason,
          };
        });

        const processingTimeMs = Date.now() - startTime;
        const tokensUsed = this.estimateTokens(prompt, text);

        return {
          analyses,
          processingTimeMs,
          tokensUsed,
        };
      } catch (error: any) {
        lastError = error;
        attempts++;

        // If we hit an error, we decide whether to retry or fallback
        const isQuotaError = error.message?.includes("429") || error.message?.includes("quota") || error.status === 429;

        // If it's a quota error OR we've exhausted all retries, return fallback results
        if (isQuotaError || attempts >= maxRetries) {
          console.error(`Gemini API Error (${attempts} attempts): ${error.message}. Falling back to neutral analysis.`);

          const analyses: SentimentAnalysis[] = request.comments.map((comment) => ({
            commentId: comment.id,
            score: 0,
            weightedScore: 0,
            emotions: ["neutral"] as EmotionTag[],
            isSarcasm: false,
            reason: isQuotaError
              ? "Analysis skipped due to API quota limits."
              : `Analysis failed after ${attempts} attempts: ${error.message}`,
          }));

          return {
            analyses,
            processingTimeMs: Date.now() - startTime,
            tokensUsed: 0,
            isPartial: true,
          };
        }

        // Otherwise, wait and retry
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        continue;
      }
    }

    // This part should theoretically not be reached due to the fallback above,
    // but kept for type safety.
    throw new AnalysisError(
      `Failed to analyze batch: ${lastError?.message || "Unknown error"}`,
      "GEMINI_BATCH_ERROR",
      lastError
    );
  }

  getConfig(): AnalysisEngineConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AnalysisEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private parseJSON<T>(text: string): T {
    // 1. Try direct parse first
    let cleanText = text.trim();
    try {
      return JSON.parse(cleanText);
    } catch {
      // Ignore and continue to more robust extraction
    }

    // 2. Remove markdown code blocks if present
    // Matches ```json [ANYTHING] ``` or ``` [ANYTHING] ```
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = cleanText.match(codeBlockRegex);
    if (match && match[1]) {
      cleanText = match[1].trim();
    }

    // 3. Last resort: find first [ or { and last ] or }
    if (!cleanText.startsWith("[") && !cleanText.startsWith("{")) {
      const startIndex = cleanText.search(/[\[\{]/);
      const endIndex = Math.max(
        cleanText.lastIndexOf("]"),
        cleanText.lastIndexOf("}")
      );
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        cleanText = cleanText.slice(startIndex, endIndex + 1);
      }
    }

    try {
      return JSON.parse(cleanText);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${cleanText.slice(0, 100)}...`);
    }
  }

  private clampScore(score: number): SentimentScore {
    return Math.max(-1, Math.min(1, score)) as SentimentScore;
  }

  private calculateWeightedScore(score: SentimentScore, likeCount: number): SentimentScore {
    // Formula: score * (1 + log10(likeCount + 1))
    const weight = 1 + Math.log10(likeCount + 1);
    const weighted = score * weight;

    // Normalize back to [-1, 1] range
    // Max possible weight is ~1 + log10(1000000) ≈ 7
    const normalized = weighted / 7;

    return this.clampScore(normalized);
  }

  private estimateTokens(prompt: string, response: string): number {
    // Rough estimate: ~1.3 tokens per word
    const totalChars = prompt.length + response.length;
    const estimatedWords = totalChars / 5; // Average word length
    return Math.ceil(estimatedWords * 1.3);
  }
}

/**
 * Create a Gemini engine instance
 */
export function createGeminiEngine(apiKey?: string, config?: Partial<AnalysisEngineConfig>): GeminiEngine {
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("Gemini API key is required. Set GEMINI_API_KEY environment variable.");
  }

  return new GeminiEngine(key, config);
}
