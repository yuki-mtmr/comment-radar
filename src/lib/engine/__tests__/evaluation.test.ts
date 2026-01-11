/**
 * Tests for Evaluation Module
 */

import { describe, it, expect } from '@jest/globals';
import {
    evaluateStanceAccuracy,
    generateEvaluationReport,
    createSampleTestSet,
    type GroundTruthItem,
} from '../evaluation';
import type { SentimentAnalysis, StanceLabel } from '@/types';

describe('Stance Evaluation', () => {
    it('should calculate perfect accuracy for correct predictions', () => {
        const groundTruth: GroundTruthItem[] = [
            { commentId: "1", text: "Great!", expectedLabel: "Support" },
            { commentId: "2", text: "Bad", expectedLabel: "Oppose" },
        ];

        const predictions: SentimentAnalysis[] = [
            {
                commentId: "1",
                score: 0.8,
                weightedScore: 0.8,
                emotions: ["supportive"],
                isSarcasm: false,
                label: "Support",
                confidence: 0.9,
            },
            {
                commentId: "2",
                score: -0.8,
                weightedScore: -0.8,
                emotions: ["critical"],
                isSarcasm: false,
                label: "Oppose",
                confidence: 0.85,
            },
        ];

        const result = evaluateStanceAccuracy(predictions, groundTruth);

        expect(result.accuracy).toBe(1.0);
        expect(result.correctPredictions).toBe(2);
        expect(result.totalSamples).toBe(2);
        expect(result.criticalErrors.length).toBe(0);
    });

    it('should detect critical errors (reversals)', () => {
        const groundTruth: GroundTruthItem[] = [
            { commentId: "1", text: "I support this", expectedLabel: "Support" },
        ];

        const predictions: SentimentAnalysis[] = [
            {
                commentId: "1",
                score: -0.8,
                weightedScore: -0.8,
                emotions: ["critical"],
                isSarcasm: false,
                label: "Oppose", // WRONG - reversed!
                confidence: 0.7,
            },
        ];

        const result = evaluateStanceAccuracy(predictions, groundTruth);

        expect(result.accuracy).toBe(0);
        expect(result.criticalErrors.length).toBe(1);
        expect(result.criticalErrors[0].severity).toBe("high");
        expect(result.criticalErrors[0].expected).toBe("Support");
        expect(result.criticalErrors[0].predicted).toBe("Oppose");
    });

    it('should calculate confusion matrix correctly', () => {
        const groundTruth: GroundTruthItem[] = [
            { commentId: "1", text: "Support", expectedLabel: "Support" },
            { commentId: "2", text: "Support2", expectedLabel: "Support" },
            { commentId: "3", text: "Oppose", expectedLabel: "Oppose" },
            { commentId: "4", text: "Neutral", expectedLabel: "Neutral" },
        ];

        const predictions: SentimentAnalysis[] = [
            {
                commentId: "1",
                score: 0.8,
                weightedScore: 0.8,
                emotions: [],
                isSarcasm: false,
                label: "Support",
            },
            {
                commentId: "2",
                score: 0,
                weightedScore: 0,
                emotions: [],
                isSarcasm: false,
                label: "Neutral", // Wrong - should be Support
            },
            {
                commentId: "3",
                score: -0.8,
                weightedScore: -0.8,
                emotions: [],
                isSarcasm: false,
                label: "Oppose",
            },
            {
                commentId: "4",
                score: 0,
                weightedScore: 0,
                emotions: [],
                isSarcasm: false,
                label: "Neutral",
            },
        ];

        const result = evaluateStanceAccuracy(predictions, groundTruth);

        // Check confusion matrix
        expect(result.confusionMatrix.Support.Support).toBe(1);
        expect(result.confusionMatrix.Support.Neutral).toBe(1);
        expect(result.confusionMatrix.Oppose.Oppose).toBe(1);
        expect(result.confusionMatrix.Neutral.Neutral).toBe(1);

        expect(result.accuracy).toBe(0.75); // 3 out of 4 correct
    });

    it('should calculate per-label metrics (precision, recall, F1)', () => {
        const groundTruth: GroundTruthItem[] = [
            { commentId: "1", text: "S1", expectedLabel: "Support" },
            { commentId: "2", text: "S2", expectedLabel: "Support" },
            { commentId: "3", text: "O1", expectedLabel: "Oppose" },
        ];

        const predictions: SentimentAnalysis[] = [
            { commentId: "1", score: 0.8, weightedScore: 0.8, emotions: [], isSarcasm: false, label: "Support" },
            { commentId: "2", score: 0.8, weightedScore: 0.8, emotions: [], isSarcasm: false, label: "Support" },
            { commentId: "3", score: 0.5, weightedScore: 0.5, emotions: [], isSarcasm: false, label: "Support" }, // FP for Support, FN for Oppose
        ];

        const result = evaluateStanceAccuracy(predictions, groundTruth);

        const supportMetrics = result.perLabelMetrics.find(m => m.label === "Support");
        expect(supportMetrics).toBeDefined();

        if (supportMetrics) {
            // TP=2, FP=1, FN=0
            expect(supportMetrics.precision).toBeCloseTo(2 / 3, 2); // 2/(2+1)
            expect(supportMetrics.recall).toBe(1.0); // 2/(2+0)
            expect(supportMetrics.f1Score).toBeCloseTo(0.8, 1); // 2*P*R/(P+R)
        }
    });

    it('should generate a readable report', () => {
        const result = evaluateStanceAccuracy(
            [
                { commentId: "1", score: 0.8, weightedScore: 0.8, emotions: [], isSarcasm: false, label: "Support" },
            ],
            [
                { commentId: "1", text: "Good!", expectedLabel: "Support" },
            ]
        );

        const report = generateEvaluationReport(result);

        expect(report).toContain("Accuracy: 100.00%");
        expect(report).toContain("Confusion Matrix");
        expect(report).toContain("Per-Label Metrics");
    });

    it('should handle sample test set', () => {
        const testSet = createSampleTestSet();

        expect(testSet.length).toBeGreaterThan(0);
        expect(testSet[0]).toHaveProperty("commentId");
        expect(testSet[0]).toHaveProperty("expectedLabel");
    });
});
