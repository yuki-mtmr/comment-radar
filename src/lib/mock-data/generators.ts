/**
 * Mock data generators for testing and development
 */

import type { YouTubeVideo, YouTubeComment, AnalyzedComment, EmotionTag } from "@/types";

// Sample comment templates
const COMMENT_TEMPLATES = [
  { text: "This is amazing! Really helpful tutorial.", sentiment: 0.8 },
  { text: "Thank you so much for this explanation!", sentiment: 0.9 },
  { text: "Great content as always. Keep it up!", sentiment: 0.7 },
  { text: "This is okay but could be better explained.", sentiment: 0.1 },
  { text: "Not sure I understand this part...", sentiment: -0.1 },
  { text: "This is terrible. Complete waste of time.", sentiment: -0.85 },
  { text: "Why would anyone watch this? So boring.", sentiment: -0.7 },
  { text: "Meh, nothing special here.", sentiment: -0.2 },
  { text: "Oh wonderful, another basic tutorial. Very helpful indeed.", sentiment: -0.6 },
  { text: "Finally someone explains this properly! 🎉", sentiment: 0.95 },
];

const CHANNEL_NAMES = [
  "Web Dev Mastery",
  "Code With Jane",
  "Tech Tutorials Pro",
  "Programming Wizard",
  "DevOps Guru",
  "Frontend Academy",
];

const VIDEO_TITLES = [
  "Complete TypeScript Tutorial for Beginners",
  "Building a Modern Web App with Next.js",
  "Mastering React Hooks in 2024",
  "Docker Tutorial - From Zero to Hero",
  "Advanced CSS Techniques You Need to Know",
  "JavaScript Performance Optimization Tips",
];

/**
 * Generate a mock YouTube video
 */
export function generateMockVideo(overrides?: Partial<YouTubeVideo>): YouTubeVideo {
  const baseDate = new Date("2024-01-10T10:00:00Z");

  return {
    id: `video_${Math.random().toString(36).substring(7)}`,
    title: VIDEO_TITLES[Math.floor(Math.random() * VIDEO_TITLES.length)],
    channelName: CHANNEL_NAMES[Math.floor(Math.random() * CHANNEL_NAMES.length)],
    channelId: `channel_${Math.random().toString(36).substring(7)}`,
    thumbnailUrl: `https://picsum.photos/seed/${Math.random()}/640/360`,
    viewCount: Math.floor(Math.random() * 500000) + 10000,
    likeCount: Math.floor(Math.random() * 20000) + 1000,
    commentCount: Math.floor(Math.random() * 1000) + 50,
    publishedAt: baseDate.toISOString(),
    description: "A comprehensive tutorial covering everything you need to know.",
    ...overrides,
  };
}

/**
 * Generate a mock YouTube comment
 */
export function generateMockComment(
  videoId: string,
  overrides?: Partial<YouTubeComment>
): YouTubeComment {
  const template = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
  const hoursAgo = Math.floor(Math.random() * 48);
  const publishedAt = new Date();
  publishedAt.setHours(publishedAt.getHours() - hoursAgo);

  return {
    id: `comment_${Math.random().toString(36).substring(7)}`,
    videoId,
    author: `User${Math.floor(Math.random() * 10000)}`,
    authorChannelId: `channel_${Math.random().toString(36).substring(7)}`,
    text: template.text,
    likeCount: Math.floor(Math.random() * 100),
    publishedAt: publishedAt.toISOString(),
    ...overrides,
  };
}

/**
 * Generate multiple mock comments
 */
export function generateMockComments(videoId: string, count: number): YouTubeComment[] {
  return Array.from({ length: count }, () => generateMockComment(videoId));
}

/**
 * Generate a mock analyzed comment with sentiment data
 */
export function generateMockAnalyzedComment(
  videoId: string,
  overrides?: Partial<AnalyzedComment>
): AnalyzedComment {
  const template = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
  const baseComment = generateMockComment(videoId, { text: template.text });

  const sentiment = template.sentiment;
  const emotions = selectEmotionsForSentiment(sentiment);
  const isSarcasm = template.text.includes("indeed") || template.text.includes("wonderful");

  return {
    ...baseComment,
    sentiment,
    weightedScore: sentiment * (1 + Math.log10(baseComment.likeCount + 1)) / 3,
    emotions,
    isSarcasm,
    ...overrides,
  };
}

/**
 * Generate multiple analyzed comments
 */
export function generateMockAnalyzedComments(
  videoId: string,
  count: number
): AnalyzedComment[] {
  return Array.from({ length: count }, () => generateMockAnalyzedComment(videoId));
}

/**
 * Generate a specific sentiment comment for testing
 */
export function generateCommentWithSentiment(
  videoId: string,
  sentiment: number,
  text?: string
): AnalyzedComment {
  let commentText = text;

  if (!commentText) {
    if (sentiment > 0.6) commentText = "This is amazing! Really helpful tutorial.";
    else if (sentiment > 0.2) commentText = "Great content as always. Keep it up!";
    else if (sentiment > -0.2) commentText = "This is okay but could be better explained.";
    else if (sentiment > -0.6) commentText = "Not sure I understand this part...";
    else commentText = "This is terrible. Complete waste of time.";
  }

  return generateMockAnalyzedComment(videoId, {
    text: commentText,
    sentiment,
    emotions: selectEmotionsForSentiment(sentiment),
  });
}

// Helper function to select emotions based on sentiment
function selectEmotionsForSentiment(sentiment: number): EmotionTag[] {
  if (sentiment > 0.6) return ["joy", "enthusiastic", "supportive"];
  if (sentiment > 0.2) return ["grateful", "supportive"];
  if (sentiment > -0.2) return ["analytical"];
  if (sentiment > -0.6) return ["disappointed", "critical"];
  return ["anger", "frustrated"];
}

/**
 * Generate a complete mock dataset for testing
 */
export function generateMockDataset(commentCount: number = 20) {
  const video = generateMockVideo();
  const comments = generateMockAnalyzedComments(video.id, commentCount);

  // Calculate distribution
  const positive = comments.filter((c) => c.sentiment > 0.2).length;
  const neutral = comments.filter((c) => c.sentiment >= -0.2 && c.sentiment <= 0.2).length;
  const negative = comments.filter((c) => c.sentiment < -0.2).length;

  // Generate timeline data
  const maxHours = 48;
  const timelinePoints = 9;
  const timeline = Array.from({ length: timelinePoints }, (_, i) => {
    const time = (maxHours / (timelinePoints - 1)) * i;
    const commentsInWindow = comments.filter((c) => {
      const commentHours = getHoursSincePublished(c.publishedAt, video.publishedAt);
      return commentHours <= time;
    });

    const avgSentiment =
      commentsInWindow.length > 0
        ? commentsInWindow.reduce((sum, c) => sum + c.sentiment, 0) / commentsInWindow.length
        : 0;

    return {
      time,
      avgSentiment,
      commentCount: commentsInWindow.length,
    };
  });

  // Generate scatter data
  const scatterData = comments.map((comment) => ({
    time: getHoursSincePublished(comment.publishedAt, video.publishedAt),
    sentiment: comment.sentiment,
    likeCount: comment.likeCount,
    text: comment.text,
    commentId: comment.id,
  }));

  return {
    video,
    comments,
    distribution: {
      positive,
      neutral,
      negative,
      total: comments.length,
    },
    timeline,
    scatterData,
    analyzedAt: new Date().toISOString(),
  };
}

// Helper to calculate hours between dates
function getHoursSincePublished(commentDate: string, videoDate: string): number {
  const diff = new Date(commentDate).getTime() - new Date(videoDate).getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
}
