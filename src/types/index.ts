/**
 * Core domain types for CommentRadar
 */

// YouTube Data Types
export interface YouTubeVideo {
  id: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  description?: string;
}

export interface YouTubeComment {
  id: string;
  videoId: string;
  author: string;
  authorChannelId?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  updatedAt?: string;
  parentId?: string; // For replies
}

// Sentiment Analysis Types
export type SentimentScore = number; // -1.0 (negative) to +1.0 (positive)

export type EmotionTag =
  | "anger"
  | "joy"
  | "sadness"
  | "fear"
  | "surprise"
  | "disgust"
  | "empathy"
  | "supportive"
  | "funny"
  | "critical"
  | "grateful"
  | "frustrated"
  | "enthusiastic"
  | "analytical"
  | "sarcasm"
  | "confused"
  | "neutral"
  | "disappointed"
  | "excited";

export interface SentimentAnalysis {
  commentId: string;
  score: SentimentScore;
  weightedScore: SentimentScore; // Score adjusted by like count
  emotions: EmotionTag[];
  isSarcasm: boolean;
  reason?: string; // Why this sentiment was assigned
}

export interface AnalyzedComment extends YouTubeComment {
  sentiment: SentimentScore;
  weightedScore: SentimentScore;
  emotions: EmotionTag[];
  isSarcasm: boolean;
  isRepeatUser?: boolean;
}

// Aggregated Analytics Types
export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  uniqueUsers: number;
}

export interface TimeSeriesPoint {
  time: number; // Hours since video published
  avgSentiment: SentimentScore;
  commentCount: number;
}

export interface ScatterDataPoint {
  time: number; // Hours since video published
  sentiment: SentimentScore;
  likeCount: number;
  text: string;
  commentId: string;
}

export interface VideoAnalysis {
  video: YouTubeVideo;
  comments: AnalyzedComment[];
  distribution: SentimentDistribution;
  timeline: TimeSeriesPoint[];
  scatterData: ScatterDataPoint[];
  analyzedAt: string;
}

// Engine Types
export interface AnalysisEngineConfig {
  batchSize: number; // Number of comments per LLM call
  maxComments?: number; // Limit total comments to analyze
  timeoutMs?: number; // API timeout
}

export interface BatchAnalysisRequest {
  comments: YouTubeComment[];
  videoContext?: {
    title: string;
    description?: string;
  };
}

export interface BatchAnalysisResponse {
  analyses: SentimentAnalysis[];
  processingTimeMs: number;
  tokensUsed?: number;
  isPartial?: boolean;
}

// Error Types
export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

export class YouTubeAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "YouTubeAPIError";
  }
}
