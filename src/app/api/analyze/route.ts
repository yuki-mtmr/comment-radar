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

      // Merge sentiment data with comments
      for (let j = 0; j < batch.length; j++) {
        const comment = batch[j];
        const analysis = result.analyses[j];

        analyzedComments.push({
          ...comment,
          sentiment: analysis.score,
          weightedScore: analysis.weightedScore,
          emotions: analysis.emotions,
          isSarcasm: analysis.isSarcasm,
        });
      }
    }

    // Calculate distribution
    const positive = analyzedComments.filter((c) => c.sentiment > 0.2).length;
    const neutral = analyzedComments.filter((c) => c.sentiment >= -0.2 && c.sentiment <= 0.2).length;
    const negative = analyzedComments.filter((c) => c.sentiment < -0.2).length;

    const distribution = {
      positive,
      neutral,
      negative,
      total: analyzedComments.length,
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
  const windowCount = Math.min(9, Math.ceil(totalHours / 6)); // 6-hour windows, max 9 points
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
