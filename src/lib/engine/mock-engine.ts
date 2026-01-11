/**
 * MockEngine - Fake sentiment analysis for development
 *
 * This engine generates realistic fake sentiment scores without calling any APIs.
 * Perfect for rapid UI development and testing.
 */

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

const DEFAULT_CONFIG: AnalysisEngineConfig = {
  batchSize: 50,
  maxComments: 500,
  timeoutMs: 5000,
};

// Predefined emotion patterns for realistic mock data
const EMOTION_PATTERNS: Record<string, { emotions: EmotionTag[]; isSarcasm: boolean }> = {
  veryPositive: { emotions: ["joy", "enthusiastic", "supportive"], isSarcasm: false },
  positive: { emotions: ["grateful", "supportive"], isSarcasm: false },
  neutral: { emotions: ["analytical"], isSarcasm: false },
  negative: { emotions: ["disappointed", "critical"], isSarcasm: false },
  veryNegative: { emotions: ["anger", "frustrated"], isSarcasm: false },
  sarcastic: { emotions: ["sarcasm", "frustrated"], isSarcasm: true },
  funny: { emotions: ["funny", "joy"], isSarcasm: false },
};

export class MockEngine implements AnalysisEngine {
  readonly name = "MockEngine";
  private config: AnalysisEngineConfig;

  constructor(config?: Partial<AnalysisEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async analyzeComment(comment: YouTubeComment): Promise<SentimentAnalysis> {
    // Simulate API delay
    await this.delay(50 + Math.random() * 100);

    const score = this.generateSentimentScore(comment);
    const pattern = this.selectEmotionPattern(score, comment.text);
    const weightedScore = this.calculateWeightedScore(score, comment.likeCount);

    return {
      commentId: comment.id,
      score,
      weightedScore,
      emotions: pattern.emotions,
      isSarcasm: pattern.isSarcasm,
      reason: this.generateReason(score, pattern),
    };
  }

  async analyzeBatch(request: BatchAnalysisRequest): Promise<BatchAnalysisResponse> {
    const startTime = Date.now();

    // Simulate batch processing delay (faster than individual calls)
    await this.delay(200 + request.comments.length * 10);

    const analyses = await Promise.all(
      request.comments.map((comment) => this.analyzeComment(comment))
    );

    const processingTimeMs = Date.now() - startTime;

    return {
      analyses,
      processingTimeMs,
      tokensUsed: this.estimateTokens(request),
    };
  }

  getConfig(): AnalysisEngineConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AnalysisEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private generateSentimentScore(comment: YouTubeComment): SentimentScore {
    const text = comment.text.toLowerCase();

    // Simple keyword-based scoring for realistic results
    let score = 0;

    // Positive indicators
    const positiveWords = [
      "great",
      "amazing",
      "love",
      "awesome",
      "excellent",
      "perfect",
      "thank",
      "helpful",
      "best",
      "wonderful",
    ];
    positiveWords.forEach((word) => {
      if (text.includes(word)) score += 0.3;
    });

    // Negative indicators
    const negativeWords = [
      "bad",
      "terrible",
      "worst",
      "hate",
      "awful",
      "useless",
      "waste",
      "disappointed",
      "boring",
      "slow",
    ];
    negativeWords.forEach((word) => {
      if (text.includes(word)) score -= 0.3;
    });

    // Sarcasm indicators (inverts score)
    const sarcasmIndicators = ["yeah right", "oh wonderful", "very helpful indeed", "great job"];
    const isSarcastic = sarcasmIndicators.some((phrase) => text.includes(phrase));
    if (isSarcastic) {
      score = -Math.abs(score);
    }

    // Exclamation marks suggest stronger sentiment
    const exclamations = (text.match(/!/g) || []).length;
    score *= 1 + exclamations * 0.1;

    // Add some randomness for variety
    score += (Math.random() - 0.5) * 0.2;

    // Clamp to valid range
    return Math.max(-1, Math.min(1, score)) as SentimentScore;
  }

  private selectEmotionPattern(
    score: SentimentScore,
    text: string
  ): { emotions: EmotionTag[]; isSarcasm: boolean } {
    const lowerText = text.toLowerCase();

    // Check for sarcasm first
    if (
      lowerText.includes("yeah right") ||
      lowerText.includes("oh wonderful") ||
      lowerText.includes("very helpful indeed")
    ) {
      return EMOTION_PATTERNS.sarcastic;
    }

    // Check for humor
    if (lowerText.includes("😂") || lowerText.includes("lol") || lowerText.includes("haha")) {
      return EMOTION_PATTERNS.funny;
    }

    // Score-based pattern selection
    if (score > 0.6) return EMOTION_PATTERNS.veryPositive;
    if (score > 0.2) return EMOTION_PATTERNS.positive;
    if (score > -0.2) return EMOTION_PATTERNS.neutral;
    if (score > -0.6) return EMOTION_PATTERNS.negative;
    return EMOTION_PATTERNS.veryNegative;
  }

  private calculateWeightedScore(score: SentimentScore, likeCount: number): SentimentScore {
    // Formula: score * (1 + log(likeCount + 1))
    const weight = 1 + Math.log10(likeCount + 1);
    const weighted = score * weight;

    // Normalize back to [-1, 1] range
    // Max possible weight is ~1 + log10(1000000) ≈ 7
    const normalized = weighted / 7;

    return Math.max(-1, Math.min(1, normalized)) as SentimentScore;
  }

  private generateReason(score: SentimentScore, pattern: typeof EMOTION_PATTERNS.positive): string {
    if (pattern.isSarcasm) {
      return "Sarcastic tone detected with negative underlying sentiment";
    }

    if (score > 0.6) return "Highly positive language with enthusiastic tone";
    if (score > 0.2) return "Positive sentiment with supportive language";
    if (score > -0.2) return "Neutral observation without strong sentiment";
    if (score > -0.6) return "Critical feedback with negative sentiment";
    return "Strong negative sentiment with frustrated tone";
  }

  private estimateTokens(request: BatchAnalysisRequest): number {
    // Rough estimate: ~1.3 tokens per word
    const totalChars = request.comments.reduce((sum, c) => sum + c.text.length, 0);
    const estimatedWords = totalChars / 5; // Average word length
    return Math.ceil(estimatedWords * 1.3);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
