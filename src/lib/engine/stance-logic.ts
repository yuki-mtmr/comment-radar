/**
 * Stance Synthesis Logic for Thread-Aware Analysis
 *
 * This module handles the "reversal logic" where a reply's stance
 * is determined by combining:
 * 1. Parent comment's stance (Support/Oppose/Neutral/Unknown)
 * 2. Reply relation (agree/disagree/clarify/question/unrelated)
 */

import type { StanceLabel, ReplyRelation, SentimentAnalysis } from "@/types";

/**
 * Synthesize final stance from parent stance and reply relation
 *
 * Core Logic:
 * - agree: Maintains parent's stance
 * - disagree: Flips parent's stance (Oppose -> Support, Support -> Oppose)
 * - clarify/question/unrelated: Neutral (no clear stance)
 *
 * Examples:
 * - Parent: Oppose, Reply: disagree => Support (double negative)
 * - Parent: Support, Reply: agree => Support (reinforcement)
 * - Parent: Support, Reply: disagree => Oppose (contradiction)
 */
export function synthesizeStance(
    parentLabel: StanceLabel,
    replyRelation: ReplyRelation
): StanceLabel {
    // Handle non-stance reply relations
    if (replyRelation === "unrelated" || replyRelation === "clarify" || replyRelation === "question") {
        return "Neutral";
    }

    // Core reversal logic: disagree flips the stance
    if (replyRelation === "disagree") {
        if (parentLabel === "Support") return "Oppose";
        if (parentLabel === "Oppose") return "Support";
        if (parentLabel === "Neutral") return "Neutral";
        return "Unknown";
    }

    // Agree maintains the stance
    if (replyRelation === "agree") {
        return parentLabel;
    }

    return "Unknown";
}

/**
 * Convert StanceLabel to SentimentScore for backward compatibility
 */
export function labelToScore(label: StanceLabel): number {
    switch (label) {
        case "Support":
            return 0.85;
        case "Oppose":
            return -0.85;
        case "Neutral":
            return 0.0;
        case "Unknown":
            return 0.0;
        default:
            return 0.0;
    }
}

/**
 * Convert SentimentScore to StanceLabel (approximate)
 */
export function scoreToLabel(score: number): StanceLabel {
    if (score >= 0.7) return "Support";
    if (score <= -0.7) return "Oppose";
    if (Math.abs(score) < 0.3) return "Neutral";
    return "Unknown";
}

/**
 * Apply stance synthesis to a batch of analyses
 *
 * This processes comments in order, ensuring parent comments
 * are analyzed before their replies.
 *
 * @param analyses - Array of sentiment analyses (may include replies)
 * @param comments - Original comment data (includes parentId)
 * @returns Updated analyses with synthesized stances
 */
export function applyStanceSynthesis(
    analyses: SentimentAnalysis[],
    comments: Array<{ id: string; parentId?: string }>
): SentimentAnalysis[] {
    // Create a map for quick lookup
    const analysisMap = new Map<string, SentimentAnalysis>();
    analyses.forEach(a => analysisMap.set(a.commentId, a));

    const commentMap = new Map<string, { id: string; parentId?: string }>();
    comments.forEach(c => commentMap.set(c.id, c));

    return analyses.map(analysis => {
        const comment = commentMap.get(analysis.commentId);

        // If not a reply, return as-is
        if (!comment?.parentId) {
            return analysis;
        }

        // Find parent analysis
        const parentAnalysis = analysisMap.get(comment.parentId);
        if (!parentAnalysis || !parentAnalysis.label) {
            // Parent not found or has no label - cannot synthesize
            return analysis;
        }

        // If this reply has no replyRelation, cannot synthesize
        if (!analysis.replyRelation) {
            return analysis;
        }

        // Synthesize stance
        const originalLabel = analysis.label;
        const synthesizedLabel = synthesizeStance(
            parentAnalysis.label,
            analysis.replyRelation
        );

        // Update the analysis with synthesized stance
        return {
            ...analysis,
            label: synthesizedLabel,
            score: labelToScore(synthesizedLabel),
            axisEvidence: analysis.axisEvidence
                ? `[Thread Context: Parent was ${parentAnalysis.label}, Reply ${analysis.replyRelation}] ${analysis.axisEvidence}`
                : `Synthesized from parent (${parentAnalysis.label}) + ${analysis.replyRelation}`,
            reason: `Original: ${originalLabel} -> Synthesized: ${synthesizedLabel} (Parent: ${parentAnalysis.label}, Relation: ${analysis.replyRelation})`,
        };
    });
}

/**
 * Validate that all parent comments are analyzed before their children
 *
 * This helps prevent issues in 2-pass batch processing
 */
export function sortCommentsByThreadOrder(
    comments: Array<{ id: string; parentId?: string }>
): Array<{ id: string; parentId?: string }> {
    const topLevel: Array<{ id: string; parentId?: string }> = [];
    const replies: Array<{ id: string; parentId?: string }> = [];

    comments.forEach(c => {
        if (c.parentId) {
            replies.push(c);
        } else {
            topLevel.push(c);
        }
    });

    // Return top-level first, then replies
    return [...topLevel, ...replies];
}
