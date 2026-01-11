/**
 * Analysis Engine interface and types
 *
 * This defines the contract for sentiment analysis engines.
 * Implementations include:
 * - MockEngine: Fake data for development
 * - LLMEngine: Real OpenAI/Gemini integration
 */

import type {
  YouTubeComment,
  SentimentAnalysis,
  BatchAnalysisRequest,
  BatchAnalysisResponse,
  AnalysisEngineConfig,
} from "@/types";

/**
 * Core interface for sentiment analysis engines
 */
export interface AnalysisEngine {
  /**
   * Engine name for logging/debugging
   */
  readonly name: string;

  /**
   * Analyze a single comment
   */
  analyzeComment(comment: YouTubeComment): Promise<SentimentAnalysis>;

  /**
   * Analyze multiple comments in a batch (recommended for LLM engines)
   */
  analyzeBatch(request: BatchAnalysisRequest): Promise<BatchAnalysisResponse>;

  /**
   * Get engine configuration
   */
  getConfig(): AnalysisEngineConfig;

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<AnalysisEngineConfig>): void;
}

/**
 * Factory function type for creating engines
 */
export type EngineFactory = (config?: Partial<AnalysisEngineConfig>) => AnalysisEngine;
