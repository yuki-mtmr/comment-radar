/**
 * LLM Prompts for sentiment analysis
 *
 * These prompts are designed to return structured JSON for batch processing.
 */

import type { YouTubeComment } from "@/types";

/**
 * System prompt for sentiment analysis
 */
export const SYSTEM_PROMPT = `You are a sentiment analysis expert specializing in YouTube comments.

Your task is to analyze comments and return structured JSON with:
- Sentiment score from -1.0 (completely negative) to +1.0 (completely positive)
- Emotion tags (e.g., "joy", "anger", "sarcasm", "supportive")
- Sarcasm detection (boolean)
- Brief reason for the sentiment

Key guidelines:
1. Consider context, sarcasm, and internet slang
2. Detect sarcasm carefully - positive words used critically should be negative
3. Neutral observations should score near 0
4. Strong emotions (enthusiasm, anger) should score near ±1
5. Be culturally aware and context-sensitive

Return ONLY valid JSON array, no additional text.`;

/**
 * Create a batch analysis prompt
 */
export function createBatchPrompt(
  comments: YouTubeComment[],
  videoContext?: { title: string; description?: string }
): string {
  const contextInfo = videoContext
    ? `Video Context:
Title: "${videoContext.title}"
${videoContext.description ? `Description: "${videoContext.description.slice(0, 200)}..."` : ""}

`
    : "";

  const commentsJson = comments.map((c, idx) => ({
    id: idx,
    commentId: c.id,
    author: c.author,
    text: c.text,
    likeCount: c.likeCount,
  }));

  return `${contextInfo}Analyze the following ${comments.length} YouTube comments and return a JSON array with sentiment analysis for each.

Comments:
${JSON.stringify(commentsJson, null, 2)}

Return format (JSON array only, no markdown):
[
  {
    "id": 0,
    "commentId": "comment_id_here",
    "score": 0.85,
    "emotions": ["joy", "supportive"],
    "isSarcasm": false,
    "reason": "Enthusiastic praise with genuine gratitude"
  },
  ...
]

Emotion tags to choose from: "joy", "anger", "sadness", "fear", "surprise", "disgust", "empathy", "supportive", "funny", "critical", "grateful", "frustrated", "enthusiastic", "analytical", "sarcasm", "confused", "disappointed", "excited"

Now analyze all ${comments.length} comments and return the JSON array:`;
}

/**
 * Create a single comment analysis prompt (fallback)
 */
export function createSingleCommentPrompt(
  comment: YouTubeComment,
  videoContext?: { title: string; description?: string }
): string {
  const contextInfo = videoContext
    ? `Video: "${videoContext.title}"\n\n`
    : "";

  return `${contextInfo}Analyze this YouTube comment:

Author: ${comment.author}
Text: "${comment.text}"
Likes: ${comment.likeCount}

Return a JSON object with sentiment analysis:
{
  "commentId": "${comment.id}",
  "score": <-1.0 to 1.0>,
  "emotions": [<emotion tags>],
  "isSarcasm": <boolean>,
  "reason": "<brief explanation>"
}

Emotion tags: "joy", "anger", "sadness", "fear", "surprise", "disgust", "empathy", "supportive", "funny", "critical", "grateful", "frustrated", "enthusiastic", "analytical", "sarcasm", "confused", "disappointed", "excited"

Return only the JSON object:`;
}
