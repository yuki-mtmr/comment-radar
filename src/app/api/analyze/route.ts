/**
 * API Route: /api/analyze
 *
 * Analyzes a YouTube video's comments for sentiment.
 */

import { NextRequest, NextResponse } from "next/server";
import { createYouTubeClient, YouTubeClient } from "@/lib/youtube/client";
import { createAnalysisEngine, isMockEngineEnabled } from "@/lib/engine/factory";
import type { VideoAnalysis, AnalyzedComment, TimeSeriesPoint, ScatterDataPoint } from "@/types";

export const runtime = "nodejs";

interface AnalyzeRequest {
  url: string;
  maxComments?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();

    if (!body.url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Extract video ID
    const videoId = YouTubeClient.extractVideoId(body.url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Check if we should use mock data (complete dataset)
    if (isMockEngineEnabled()) {
      // Use mock data for development
      const { generateMockDataset } = await import("@/lib/mock-data/generators");
      const mockData = generateMockDataset(body.maxComments || 20);

      return NextResponse.json(mockData);
    }

    // Real YouTube API integration with sentiment analysis
    const youtubeClient = createYouTubeClient();
    const engine = createAnalysisEngine(); // Auto-selects engine based on environment

    // Fetch video metadata
    const video = await youtubeClient.getVideo(videoId);

    // Fetch comments
    const maxComments = body.maxComments || 100;
    const comments = await youtubeClient.getComments(videoId, { maxComments });

    if (comments.length === 0) {
      return NextResponse.json({
        error: "No comments found for this video",
      }, { status: 404 });
    }

    // Analyze comments in batches
    const batchSize = engine.getConfig().batchSize;
    const analyzedComments: AnalyzedComment[] = [];

    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      const result = await engine.analyzeBatch({
        comments: batch,
        videoContext: {
          title: video.title,
          description: video.description,
        },
      });

      // Merge sentiment data with comments and detect repeat users
      const seenUserIds = new Set<string>();
      for (let j = 0; j < batch.length; j++) {
        const comment = batch[j];
        const analysis = result.analyses[j];

        if (!analysis) {
          console.warn(`No analysis result for comment ${comment.id} at index ${j}`);
          continue;
        }

        const userId = comment.authorChannelId || comment.author;
        const isRepeatUser = seenUserIds.has(userId);
        seenUserIds.add(userId);

        analyzedComments.push({
          ...comment,
          sentiment: analysis.score,
          weightedScore: analysis.weightedScore,
          emotions: analysis.emotions,
          isSarcasm: analysis.isSarcasm,
          isRepeatUser,
        });
      }

      // Add a delay between batches to stay under 15 RPM (free tier limit)
      if (i + batchSize < comments.length) {
        await new Promise(resolve => setTimeout(resolve, 3500));
      }
    }

    // Calculate unique users across all comments
    const allUniqueUsers = new Set(analyzedComments.map(c => c.authorChannelId || c.author));

    // Calculate distribution with bias reduction
    // We give slightly less weight (0.5x) to multiple comments from the same user
    // to prevent a single user from dominating the sentiment.
    let positiveWeight = 0;
    let neutralWeight = 0;
    let negativeWeight = 0;

    analyzedComments.forEach(c => {
      const weight = c.isRepeatUser ? 0.5 : 1.0;
      if (c.sentiment > 0.2) positiveWeight += weight;
      else if (c.sentiment < -0.2) negativeWeight += weight;
      else neutralWeight += weight;
    });

    const totalWeight = positiveWeight + neutralWeight + negativeWeight;

    // Normalize weights to match total comment count for the UI display
    const scaleFactor = analyzedComments.length / totalWeight;

    const distribution = {
      positive: Math.round(positiveWeight * scaleFactor),
      neutral: Math.round(neutralWeight * scaleFactor),
      negative: Math.round(negativeWeight * scaleFactor),
      total: analyzedComments.length,
      uniqueUsers: allUniqueUsers.size,
    };

    // Generate timeline data
    const timeline = generateTimeline(analyzedComments, video.publishedAt);

    // Generate scatter data
    const scatterData = generateScatterData(analyzedComments, video.publishedAt);

    const response: VideoAnalysis = {
      video,
      comments: analyzedComments,
      distribution,
      timeline,
      scatterData,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analysis error:", error);

    if (error && typeof error === "object" && "code" in error) {
      const apiError = error as { code: string; message: string; statusCode?: number };

      // Handle specific YouTube API errors
      if (apiError.code === "VIDEO_NOT_FOUND") {
        return NextResponse.json(
          { error: "Video not found. Please check the URL." },
          { status: 404 }
        );
      }

      if (apiError.code === "COMMENTS_DISABLED") {
        return NextResponse.json(
          { error: "Comments are disabled for this video." },
          { status: 403 }
        );
      }

      if (apiError.code === "TIMEOUT") {
        return NextResponse.json(
          { error: "Request timeout. The video may have too many comments." },
          { status: 408 }
        );
      }

      if (apiError.code === "GEMINI_QUOTA_EXCEEDED") {
        return NextResponse.json(
          { error: "Gemini API quota exceeded. Please wait a minute before trying again." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: apiError.message || "API error occurred" },
        { status: apiError.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Generate timeline data from analyzed comments
 */
function generateTimeline(comments: AnalyzedComment[], videoPublishedAt: string): TimeSeriesPoint[] {
  const videoDate = new Date(videoPublishedAt);
  const now = new Date();
  const totalHours = (now.getTime() - videoDate.getTime()) / (1000 * 60 * 60);

  // Create time windows
  const windowCount = Math.max(1, Math.min(9, Math.ceil(totalHours / 6)));
  const windowSize = totalHours / windowCount;

  const timeline: TimeSeriesPoint[] = [];

  for (let i = 0; i < windowCount; i++) {
    const windowEnd = windowSize * (i + 1);

    const commentsInWindow = comments.filter((c) => {
      const commentDate = new Date(c.publishedAt);
      const hoursSinceVideo = (commentDate.getTime() - videoDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceVideo <= windowEnd;
    });

    const avgSentiment =
      commentsInWindow.length > 0
        ? commentsInWindow.reduce((sum, c) => sum + c.sentiment, 0) / commentsInWindow.length
        : 0;

    timeline.push({
      time: windowEnd,
      avgSentiment,
      commentCount: commentsInWindow.length,
    });
  }

  return timeline;
}

/**
 * Generate scatter plot data from analyzed comments
 */
function generateScatterData(comments: AnalyzedComment[], videoPublishedAt: string): ScatterDataPoint[] {
  const videoDate = new Date(videoPublishedAt);

  return comments.map((comment) => {
    const commentDate = new Date(comment.publishedAt);
    const hoursSinceVideo = (commentDate.getTime() - videoDate.getTime()) / (1000 * 60 * 60);

    return {
      time: Math.max(0, hoursSinceVideo),
      sentiment: comment.sentiment,
      likeCount: comment.likeCount,
      text: comment.text,
      commentId: comment.id,
    };
  });
}
