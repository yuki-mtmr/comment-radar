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
  transcript?: string;
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
  parentText?: string; // Content of the parent comment
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

// Axis-Based Stance Analysis Types
export type StanceLabel = "Support" | "Oppose" | "Neutral" | "Unknown";

export type ReplyRelation = "agree" | "disagree" | "clarify" | "question" | "unrelated";

export type SpeechAct = "assertion" | "question" | "joke" | "sarcasm" | "insult" | "praise" | "other";

export interface AxisProfile {
  videoId: string;
  mainAxis: string; // e.g., "この教育方針は有効か"
  creatorPosition: string; // e.g., "座学より実践を重視すべき"
  targetOfCriticism?: string; // e.g., "理論ばかりで行動しない人"
  supportedValues?: string; // e.g., "実践的な学び、行動力"
  generatedAt: string;
}

export interface SentimentAnalysis {
  commentId: string;
  score: SentimentScore;
  weightedScore: SentimentScore; // Score adjusted by like count
  emotions: EmotionTag[];
  isSarcasm: boolean;
  reason?: string; // Why this sentiment was assigned
  // New Axis-based fields
  label?: StanceLabel; // Stance toward the main axis
  confidence?: number; // 0.0 to 1.0
  axisEvidence?: string; // Evidence for stance judgment
  replyRelation?: ReplyRelation; // Relation to parent comment
  speechAct?: SpeechAct; // Type of speech act
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
  isPartial?: boolean;
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
    channelName: string;
    description?: string;
    summary?: string;
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
