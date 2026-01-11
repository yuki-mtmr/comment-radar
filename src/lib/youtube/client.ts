/**
 * YouTube Data API v3 Client
 *
 * Wrapper for YouTube API with proper error handling and rate limiting.
 */

import type { YouTubeVideo, YouTubeComment, YouTubeAPIError } from "@/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeAPIConfig {
  apiKey: string;
  maxResults?: number;
  timeout?: number;
}

interface VideoResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      channelId: string;
      publishedAt: string;
      description: string;
      thumbnails: {
        high: { url: string };
      };
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
    };
  }>;
}

interface CommentThreadResponse {
  items: Array<{
    snippet: {
      topLevelComment: {
        id: string;
        snippet: {
          authorDisplayName: string;
          authorChannelId?: { value: string };
          textDisplay: string;
          likeCount: number;
          publishedAt: string;
          updatedAt: string;
        };
      };
    };
  }>;
  nextPageToken?: string;
}

export class YouTubeClient {
  private apiKey: string;
  private maxResults: number;
  private timeout: number;

  constructor(config: YouTubeAPIConfig) {
    this.apiKey = config.apiKey;
    this.maxResults = config.maxResults || 100;
    this.timeout = config.timeout || 10000;
  }

  /**
   * Extract video ID from various YouTube URL formats
   */
  static extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
      if (urlObj.hostname.includes("youtube.com") && urlObj.searchParams.has("v")) {
        return urlObj.searchParams.get("v");
      }

      // Short URL: https://youtu.be/VIDEO_ID
      if (urlObj.hostname === "youtu.be") {
        return urlObj.pathname.slice(1);
      }

      // Embed URL: https://www.youtube.com/embed/VIDEO_ID
      if (urlObj.pathname.startsWith("/embed/")) {
        return urlObj.pathname.split("/")[2];
      }

      return null;
    } catch {
      // If URL parsing fails, try regex as fallback
      const regexMatch = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return regexMatch ? regexMatch[1] : null;
    }
  }

  /**
   * Fetch video metadata
   */
  async getVideo(videoId: string): Promise<YouTubeVideo> {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", this.apiKey);

    const response = await this.fetchWithTimeout<VideoResponse>(url.toString());

    if (!response.items || response.items.length === 0) {
      throw this.createError("Video not found", "VIDEO_NOT_FOUND", 404);
    }

    const item = response.items[0];
    const { snippet, statistics } = item;

    return {
      id: item.id,
      title: snippet.title,
      channelName: snippet.channelTitle,
      channelId: snippet.channelId,
      thumbnailUrl: snippet.thumbnails.high.url,
      viewCount: parseInt(statistics.viewCount, 10),
      likeCount: parseInt(statistics.likeCount || "0", 10),
      commentCount: parseInt(statistics.commentCount || "0", 10),
      publishedAt: snippet.publishedAt,
      description: snippet.description,
    };
  }

  /**
   * Fetch comments for a video with pagination
   */
  async getComments(
    videoId: string,
    options?: {
      maxComments?: number;
      order?: "time" | "relevance";
    }
  ): Promise<YouTubeComment[]> {
    const maxComments = options?.maxComments || this.maxResults;
    const order = options?.order || "relevance";

    const comments: YouTubeComment[] = [];
    let pageToken: string | undefined;

    while (comments.length < maxComments) {
      const url = new URL(`${YOUTUBE_API_BASE}/commentThreads`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("videoId", videoId);
      url.searchParams.set("order", order);
      url.searchParams.set("maxResults", Math.min(100, maxComments - comments.length).toString());
      url.searchParams.set("key", this.apiKey);

      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      try {
        const response = await this.fetchWithTimeout<CommentThreadResponse>(url.toString());

        if (!response.items || response.items.length === 0) {
          break; // No more comments
        }

        for (const item of response.items) {
          const comment = item.snippet.topLevelComment;
          const snippet = comment.snippet;

          comments.push({
            id: comment.id,
            videoId,
            author: snippet.authorDisplayName,
            authorChannelId: snippet.authorChannelId?.value,
            text: snippet.textDisplay,
            likeCount: snippet.likeCount,
            publishedAt: snippet.publishedAt,
            updatedAt: snippet.updatedAt,
          });

          if (comments.length >= maxComments) {
            break;
          }
        }

        pageToken = response.nextPageToken;

        if (!pageToken) {
          break; // No more pages
        }
      } catch (error) {
        // If comments are disabled or restricted
        if (this.isCommentsDisabledError(error)) {
          throw this.createError("Comments are disabled for this video", "COMMENTS_DISABLED", 403);
        }
        throw error;
      }
    }

    return comments;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(
          errorData.error?.message || `HTTP ${response.status}`,
          errorData.error?.errors?.[0]?.reason || "API_ERROR",
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw this.createError("Request timeout", "TIMEOUT", 408);
        }
        if ("statusCode" in error) {
          throw error; // Already a YouTubeAPIError
        }
      }
      throw this.createError(
        error instanceof Error ? error.message : "Unknown error",
        "NETWORK_ERROR"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if error is due to disabled comments
   */
  private isCommentsDisabledError(error: unknown): boolean {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code: string }).code;
      return code === "commentsDisabled" || code === "COMMENTS_DISABLED";
    }
    return false;
  }

  /**
   * Create a YouTubeAPIError
   */
  private createError(message: string, code: string, statusCode?: number): YouTubeAPIError {
    const error = new Error(message) as YouTubeAPIError;
    error.name = "YouTubeAPIError";
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
}

/**
 * Create a YouTube client instance
 */
export function createYouTubeClient(apiKey?: string): YouTubeClient {
  const key = apiKey || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  if (!key) {
    throw new Error("YouTube API key is required. Set NEXT_PUBLIC_YOUTUBE_API_KEY environment variable.");
  }

  return new YouTubeClient({ apiKey: key });
}
