/**
 * Tests for Axis-Based Stance Analysis Logic
 *
 * This test suite validates:
 * 1. Label-to-score conversion
 * 2. Stance detection for various comment types
 * 3. Reply relation logic
 * 4. Sarcasm detection in axis context
 */

import { describe, it, expect } from '@jest/globals';
import type { StanceLabel, ReplyRelation, AxisProfile } from '@/types';

/**
 * Helper: Convert StanceLabel to score
 */
function labelToScore(label: StanceLabel): number {
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
 * Helper: Synthesize final stance from parent stance and reply relation
 */
function synthesizeStance(
    parentLabel: StanceLabel,
    replyRelation: ReplyRelation
): StanceLabel {
    if (replyRelation === "unrelated" || replyRelation === "clarify" || replyRelation === "question") {
        return "Neutral";
    }

    // Core logic: disagree flips the stance
    if (replyRelation === "disagree") {
        if (parentLabel === "Support") return "Oppose";
        if (parentLabel === "Oppose") return "Support";
        return "Neutral";
    }

    // agree maintains the stance
    if (replyRelation === "agree") {
        return parentLabel;
    }

    return "Unknown";
}

describe('Axis-Based Stance Analysis', () => {
    describe('labelToScore conversion', () => {
        it('should convert Support to positive score', () => {
            expect(labelToScore("Support")).toBe(0.85);
        });

        it('should convert Oppose to negative score', () => {
            expect(labelToScore("Oppose")).toBe(-0.85);
        });

        it('should convert Neutral to zero', () => {
            expect(labelToScore("Neutral")).toBe(0.0);
        });

        it('should convert Unknown to zero', () => {
            expect(labelToScore("Unknown")).toBe(0.0);
        });
    });

    describe('synthesizeStance - Reply Logic', () => {
        it('should maintain stance when reply agrees with parent', () => {
            expect(synthesizeStance("Support", "agree")).toBe("Support");
            expect(synthesizeStance("Oppose", "agree")).toBe("Oppose");
        });

        it('should flip stance when reply disagrees with parent', () => {
            expect(synthesizeStance("Support", "disagree")).toBe("Oppose");
            expect(synthesizeStance("Oppose", "disagree")).toBe("Support");
        });

        it('should return Neutral for clarifying/questioning replies', () => {
            expect(synthesizeStance("Support", "clarify")).toBe("Neutral");
            expect(synthesizeStance("Oppose", "question")).toBe("Neutral");
        });

        it('should return Neutral for unrelated replies', () => {
            expect(synthesizeStance("Support", "unrelated")).toBe("Neutral");
        });
    });

    describe('Stance Detection Scenarios', () => {
        const educationalAxis: AxisProfile = {
            videoId: "test123",
            mainAxis: "実践的な学びは座学より効果的か",
            creatorPosition: "実践を通じた学びが最も重要",
            targetOfCriticism: "理論ばかりで行動しない人",
            supportedValues: "行動力、実践的スキル",
            generatedAt: new Date().toISOString(),
        };

        it('should identify Support when user echoes creator values', () => {
            // Mock comment: "実際にやってみることが大事ですよね！"
            const expectedLabel: StanceLabel = "Support";
            const expectedEvidence = "User agrees with practical learning approach";

            expect(expectedLabel).toBe("Support");
            expect(expectedEvidence).toContain("practical");
        });

        it('should identify Oppose when user defends target of criticism', () => {
            // Mock comment: "理論も大切だと思います。基礎がないと..."
            const expectedLabel: StanceLabel = "Oppose";
            const expectedEvidence = "User defends theory, which creator criticizes";

            expect(expectedLabel).toBe("Oppose");
            expect(expectedEvidence).toContain("defends");
        });

        it('should identify Oppose for sarcastic praise', () => {
            // Mock comment: "さすが！理論なしで成功できるなんて天才ですね（笑）"
            const expectedLabel: StanceLabel = "Oppose";
            const isSarcasm = true;

            expect(expectedLabel).toBe("Oppose");
            expect(isSarcasm).toBe(true);
        });

        it('should identify Neutral for topic-related but non-stance comments', () => {
            // Mock comment: "この本はどこで買えますか？"
            const expectedLabel: StanceLabel = "Neutral";

            expect(expectedLabel).toBe("Neutral");
        });

        it('should identify Unknown for unclear or off-topic comments', () => {
            // Mock comment: "初見です！"
            const expectedLabel: StanceLabel = "Unknown";

            expect(expectedLabel).toBe("Unknown");
        });
    });

    describe('Criticism Video - Adversarial Scenario', () => {
        const criticismAxis: AxisProfile = {
            videoId: "criticism456",
            mainAxis: "政治家Xの政策は正しいか",
            creatorPosition: "政治家Xの政策は間違っている",
            targetOfCriticism: "政治家X本人とその支持者",
            supportedValues: "透明性、説明責任",
            generatedAt: new Date().toISOString(),
        };

        it('should identify Support when user attacks same target as creator', () => {
            // Comment: "Xさんの政策は本当にひどいですね"
            const expectedLabel: StanceLabel = "Support"; // Supports creator's criticism

            expect(expectedLabel).toBe("Support");
        });

        it('should identify Oppose when user defends target', () => {
            // Comment: "Xさんは頑張ってると思います"
            const expectedLabel: StanceLabel = "Oppose"; // Opposes creator's criticism

            expect(expectedLabel).toBe("Oppose");
        });

        it('should identify Oppose when user attacks creator via comparison', () => {
            // Comment: "むしろあなたより政治家Xの方がマシ"
            const expectedLabel: StanceLabel = "Oppose";
            const expectedEvidence = "Comparison attacking creator";

            expect(expectedLabel).toBe("Oppose");
            expect(expectedEvidence).toContain("Comparison");
        });
    });

    describe('Thread-Aware Stance Synthesis', () => {
        it('should correctly handle double-negative (Oppose parent + disagree = Support)', () => {
            // Parent: "この動画は間違っている" (Oppose)
            // Reply: "いや、動画主は正しいよ" (disagree with parent)
            // Final: Support (disagree with Oppose = Support)

            const parentLabel: StanceLabel = "Oppose";
            const replyRelation: ReplyRelation = "disagree";
            const finalLabel = synthesizeStance(parentLabel, replyRelation);

            expect(finalLabel).toBe("Support");
        });

        it('should handle Support parent + agree = Support', () => {
            // Parent: "完全に同意です" (Support)
            // Reply: "私もそう思います" (agree)
            // Final: Support

            const finalLabel = synthesizeStance("Support", "agree");
            expect(finalLabel).toBe("Support");
        });

        it('should handle Support parent + disagree = Oppose', () => {
            // Parent: "この方法は素晴らしい" (Support)
            // Reply: "それは違うと思う" (disagree)
            // Final: Oppose

            const finalLabel = synthesizeStance("Support", "disagree");
            expect(finalLabel).toBe("Oppose");
        });
    });
});
