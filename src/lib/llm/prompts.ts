/**
 * LLM Prompts for sentiment analysis
 *
 * These prompts are designed to return structured JSON for batch processing.
 */

import type { YouTubeComment, AxisProfile } from "@/types";

/**
 * System prompt for sentiment analysis
 */
export const SYSTEM_PROMPT = `You are a specialized Sentiment & Stance Analysis agent for YouTube.

Your task is to determine a comment's alignment with the Video Creator based on the provided Video Context.

### 1. ROLE IDENTIFICATION (Identify these from Video Summary):
- [Creator]: The channel owner.
- [Opponent]: Any person, group, or idea the creator is criticizing or arguing against.
- [Topic]: The general subject matter.

### 2. ALIGNMENT MATRIX (Worldview Alignment):
| User Action | Context from Summary | Final Sentiment |
| :--- | :--- | :--- |
| Agrees with / Echoes | [Creator's Values / Main Message] | POSITIVE (+1.0) |
| Criticizes / Attacks | [What the Creator is Attacking] | POSITIVE (+1.0) |
| Comparisons (Unfavorable) | [Praising someone else to mock Creator] | NEGATIVE (-1.0) |
| Defends / Praises | [What the Creator is Attacking] | NEGATIVE (-1.0) |
| Attacks / Criticizes | [Creator or Creator's Views] | NEGATIVE (-1.0) |
| Hypocrisy Check | ["Who are you to talk?" / "どの口で"] | NEGATIVE (-1.0) |
| Matches | [Creator's specific terminology/stance] | POSITIVE (+0.8) |
| General comment | [Topic] | NEUTRAL (0.0) |

### 3. EXPLICIT LOGIC FOR "VALUES":
- If the creator says "X is bad and Y is good":
  - A user saying "I hate X" is POSITIVE (Aligned with creator).
  - A user saying "I love Y" is POSITIVE (Aligned with creator).
  - A user saying "X is not that bad" is NEGATIVE (Opposed to creator).

### 3. LINGUISTIC NUANCES:
- Sarcasm: Detecting praise used ironically to highlight failure.
- Mockery: Detecting derogatory comparisons (e.g., "Person X does better than you").
- Contextual Loyalty: A mocking tone is POSITIVE ONLY IF attacking an [Opponent].
- Hypocrisy: Direct attacks on the Creator's consistency/authority (e.g., "Look who's talking") are NEGATIVE.

### 4. SCHEMA COMPLIANCE (MUST FOLLOW):
- "score": Numeric ONLY. Use 0.8 (CORRECT), NOT +0.8 (WRONG).
- "isSarcasm": Boolean ONLY. Use true/false (CORRECT), NOT "true"/"false" (WRONG).
- "reason": Single line string. No " (double quotes) or \\ (backslashes) inside.
- DELIMITERS: No extra ] or } at the end.

JSON TEMPLATE:
{
  "comments": [
    {
      "commentId": "...",
      "reason": "Target:[x]. Intent:[x]. Reasoning:[x]",
      "score": 0.8,
      "emotions": ["supportive"],
      "isSarcasm": false
    }
  ]
}

Return ONLY the JSON. No preamble. No + sign in scores.`;

/**
 * Create a batch analysis prompt
 */
export function createBatchPrompt(
  comments: YouTubeComment[],
  videoContext?: { title: string; channelName: string; description?: string; summary?: string }
): string {
  const contextInfo = videoContext
    ? `### VIDEO CONTEXT (READ THIS FIRST)
Creator: "${videoContext.channelName}"
Title: "${videoContext.title}"

--- VIDEO SUMMARY & STANCE ---
${videoContext.summary || "No summary available."}
------------------------------

`
    : "";

  const commentsJson = comments.map((c) => ({
    commentId: c.id,
    author: c.author,
    text: c.text,
    parentText: c.parentText,
  }));

  return `${contextInfo}Analyze ${comments.length} comments.

MISSION:
- Use the "VIDEO SUMMARY" to identify who the "Opponents" or "Critics" are.
- Support for those Opponents MUST be scored as NEGATIVE sentiment for this video.

JSON format:
{
  "comments": [
    {
      "commentId": "...",
      "reason": "Target: [Creator/Opponent/Topic/Other]. Reason: ...",
      "score": -0.8,
      "emotions": ["critical"],
      "isSarcasm": false
    }
  ]
}

Comments to analyze:
${JSON.stringify(commentsJson, null, 2)}

Emotion tags: "joy", "anger", "sadness", "fear", "surprise", "disgust", "empathy", "supportive", "funny", "critical", "grateful", "frustrated", "enthusiastic", "analytical", "sarcasm", "confused", "disappointed", "excited"`;
}

/**
 * Create a single comment analysis prompt (fallback)
 */
export function createSingleCommentPrompt(
  comment: YouTubeComment,
  videoContext?: { title: string; channelName: string; description?: string }
): string {
  const contextInfo = videoContext
    ? `Creator: "${videoContext.channelName}"\nVideo: "${videoContext.title}"\n\n`
    : "";

  return `${contextInfo}Analyze this YouTube comment:

Author: ${comment.author}
Text: "${comment.text}"

Return a JSON object with "reason" first to think before scoring:
{
  "commentId": "${comment.id}",
  "reason": "<explain context and subject here>",
  "score": <-1.0 to 1.0>,
  "emotions": [<emotion tags>],
  "isSarcasm": <boolean>
}

Emotion tags: "joy", "anger", "sadness", "fear", "surprise", "disgust", "empathy", "supportive", "funny", "critical", "grateful", "frustrated", "enthusiastic", "analytical", "sarcasm", "confused", "disappointed", "excited"

Return only the JSON object:`;
}

/**
 * NEW: Axis-based System Prompt for Stance Analysis
 */
export const AXIS_SYSTEM_PROMPT = `You are an advanced Stance Analysis agent for YouTube comments.

Your task is to determine each comment's stance (Support/Oppose/Neutral/Unknown) toward the video's MAIN AXIS.

### CORE CONCEPT: AXIS vs CREATOR
- DO NOT judge sentiment toward the creator as a person.
- JUDGE the commenter's position on the MAIN AXIS (the central claim or topic).

### OUTPUT SCHEMA:
{
  "comments": [
    {
      "commentId": "...",
      "label": "Support" | "Oppose" | "Neutral" | "Unknown",
      "confidence": 0.85,
      "axisEvidence": "User agrees with [creator's position] by saying '...'",
      "replyRelation": "agree" | "disagree" | "clarify" | "question" | "unrelated",
      "speechAct": "assertion" | "question" | "joke" | "sarcasm" | "insult" | "praise" | "other",
      "score": 0.8,
      "emotions": ["supportive"],
      "isSarcasm": false,
      "reason": "Brief explanation"
    }
  ]
}

### STANCE LABELS:
- "Support": Commenter AGREES with the creator's position on the axis
- "Oppose": Commenter DISAGREES with the creator's position on the axis
- "Neutral": Comment is about the topic but doesn't take a clear stance
- "Unknown": Cannot determine stance (off-topic, unclear, insufficient context)

### REPLY LOGIC:
- If comment has "parentText", analyze the relationship to parent first
- replyRelation values:
  - "agree": Affirms or builds on parent's point
  - "disagree": Contradicts or argues against parent
  - "clarify": Adds context or explanation
  - "question": Asks for more info
  - "unrelated": Changes topic

### SCORE CONVERSION (for backward compatibility):
- Support → score: +0.7 to +1.0
- Neutral → score: -0.3 to +0.3
- Oppose → score: -1.0 to -0.7
- Unknown → score: 0.0

### CRITICAL RULES:
1. If context is unclear, use "Unknown" - do NOT guess
2. Sarcasm detection: Positive words used to mock = "Oppose" + isSarcasm: true
3. Thread awareness: Parent stance affects child stance interpretation
4. Evidence: Always cite specific phrases from the comment in axisEvidence

Return ONLY valid JSON. No preamble. No trailing commas.`;

/**
 * NEW: Create Axis-based batch prompt
 */
export function createAxisBatchPrompt(
  comments: YouTubeComment[],
  axisProfile: AxisProfile,
  videoContext?: { title: string; channelName: string; description?: string; summary?: string }
): string {
  const contextInfo = `### AXIS PROFILE (PRIMARY REFERENCE)
Video ID: ${axisProfile.videoId}
Main Axis: "${axisProfile.mainAxis}"
Creator's Position: "${axisProfile.creatorPosition}"
${axisProfile.targetOfCriticism ? `Target of Criticism: "${axisProfile.targetOfCriticism}"` : ""}
${axisProfile.supportedValues ? `Supported Values: "${axisProfile.supportedValues}"` : ""}

### VIDEO METADATA
Creator: "${videoContext?.channelName || "Unknown"}"
Title: "${videoContext?.title || "Unknown"}"
${videoContext?.summary ? `Summary: ${videoContext.summary}` : ""}

`;

  const commentsJson = comments.map((c) => ({
    commentId: c.id,
    author: c.author,
    text: c.text,
    parentText: c.parentText || null,
    parentId: c.parentId || null,
  }));

  return `${contextInfo}
Analyze ${comments.length} comments based on their stance toward the MAIN AXIS.

TASK:
1. For each comment, determine if the user supports or opposes the creator's position on the axis
2. If the comment is a reply (has parentText), first analyze replyRelation to parent
3. Provide evidence from the comment text in axisEvidence
4. Assign confidence (0.0-1.0) based on clarity of stance

Comments to analyze:
${JSON.stringify(commentsJson, null, 2)}

Return JSON following the schema in the system prompt.`;
}
