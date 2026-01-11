/**
 * Accuracy Evaluation Tools for Axis-Based Stance Analysis
 *
 * This module provides tools to:
 * 1. Measure accuracy against ground truth labels
 * 2. Detect critical errors (reversed judgments)
 * 3. Generate evaluation reports
 */

import type { StanceLabel, SentimentAnalysis } from "@/types";

export interface GroundTruthItem {
    commentId: string;
    text: string;
    expectedLabel: StanceLabel;
    notes?: string;
}

export interface EvaluationResult {
    accuracy: number; // 0.0 to 1.0
    totalSamples: number;
    correctPredictions: number;
    confusionMatrix: {
        Support: { Support: number; Oppose: number; Neutral: number; Unknown: number };
        Oppose: { Support: number; Oppose: number; Neutral: number; Unknown: number };
        Neutral: { Support: number; Oppose: number; Neutral: number; Unknown: number };
        Unknown: { Support: number; Oppose: number; Neutral: number; Unknown: number };
    };
    criticalErrors: CriticalError[];
    perLabelMetrics: {
        label: StanceLabel;
        precision: number;
        recall: number;
        f1Score: number;
    }[];
}

export interface CriticalError {
    commentId: string;
    text: string;
    expected: StanceLabel;
    predicted: StanceLabel;
    severity: "high" | "medium" | "low";
    reason: string;
}

/**
 * Evaluate predictions against ground truth
 */
export function evaluateStanceAccuracy(
    predictions: SentimentAnalysis[],
    groundTruth: GroundTruthItem[]
): EvaluationResult {
    const confusionMatrix: EvaluationResult["confusionMatrix"] = {
        Support: { Support: 0, Oppose: 0, Neutral: 0, Unknown: 0 },
        Oppose: { Support: 0, Oppose: 0, Neutral: 0, Unknown: 0 },
        Neutral: { Support: 0, Oppose: 0, Neutral: 0, Unknown: 0 },
        Unknown: { Support: 0, Oppose: 0, Neutral: 0, Unknown: 0 },
    };

    const criticalErrors: CriticalError[] = [];
    let correctPredictions = 0;

    const gtMap = new Map(groundTruth.map(gt => [gt.commentId, gt]));

    predictions.forEach(pred => {
        const gt = gtMap.get(pred.commentId);
        if (!gt || !pred.label) return;

        const expected = gt.expectedLabel;
        const predicted = pred.label;

        // Update confusion matrix
        confusionMatrix[expected][predicted]++;

        // Check if correct
        if (expected === predicted) {
            correctPredictions++;
        } else {
            // Identify critical errors (reversals)
            const severity = getCriticalErrorSeverity(expected, predicted);
            if (severity) {
                criticalErrors.push({
                    commentId: pred.commentId,
                    text: gt.text,
                    expected,
                    predicted,
                    severity,
                    reason: pred.reason || "No reason provided",
                });
            }
        }
    });

    const totalSamples = predictions.filter(p => p.label && gtMap.has(p.commentId)).length;
    const accuracy = totalSamples > 0 ? correctPredictions / totalSamples : 0;

    // Calculate per-label metrics
    const labels: StanceLabel[] = ["Support", "Oppose", "Neutral", "Unknown"];
    const perLabelMetrics = labels.map(label => {
        const truePositive = confusionMatrix[label][label];
        const falsePositive = labels.reduce((sum, l) => sum + (l !== label ? confusionMatrix[l][label] : 0), 0);
        const falseNegative = labels.reduce((sum, l) => sum + (l !== label ? confusionMatrix[label][l] : 0), 0);

        const precision = truePositive + falsePositive > 0 ? truePositive / (truePositive + falsePositive) : 0;
        const recall = truePositive + falseNegative > 0 ? truePositive / (truePositive + falseNegative) : 0;
        const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        return { label, precision, recall, f1Score };
    });

    return {
        accuracy,
        totalSamples,
        correctPredictions,
        confusionMatrix,
        criticalErrors,
        perLabelMetrics,
    };
}

/**
 * Determine severity of prediction error
 */
function getCriticalErrorSeverity(
    expected: StanceLabel,
    predicted: StanceLabel
): "high" | "medium" | "low" | null {
    // High severity: Complete reversal (Support <-> Oppose)
    if ((expected === "Support" && predicted === "Oppose") || (expected === "Oppose" && predicted === "Support")) {
        return "high";
    }

    // Medium severity: Stance vs Neutral confusion
    if (
        (expected === "Support" || expected === "Oppose") && predicted === "Neutral" ||
        expected === "Neutral" && (predicted === "Support" || predicted === "Oppose")
    ) {
        return "medium";
    }

    // Low severity: Unknown confusion
    if (expected === "Unknown" || predicted === "Unknown") {
        return "low";
    }

    return null;
}

/**
 * Generate a human-readable evaluation report
 */
export function generateEvaluationReport(result: EvaluationResult): string {
    const lines: string[] = [];

    lines.push("=== Stance Analysis Evaluation Report ===\n");
    lines.push(`Total Samples: ${result.totalSamples}`);
    lines.push(`Correct Predictions: ${result.correctPredictions}`);
    lines.push(`Accuracy: ${(result.accuracy * 100).toFixed(2)}%\n`);

    lines.push("--- Per-Label Metrics ---");
    result.perLabelMetrics.forEach(metric => {
        lines.push(`${metric.label}:`);
        lines.push(`  Precision: ${(metric.precision * 100).toFixed(2)}%`);
        lines.push(`  Recall: ${(metric.recall * 100).toFixed(2)}%`);
        lines.push(`  F1-Score: ${(metric.f1Score * 100).toFixed(2)}%`);
    });

    lines.push("\n--- Confusion Matrix ---");
    lines.push("             Predicted:");
    lines.push("             Support  Oppose  Neutral  Unknown");
    const labels: StanceLabel[] = ["Support", "Oppose", "Neutral", "Unknown"];
    labels.forEach(actual => {
        const row = labels.map(pred => result.confusionMatrix[actual][pred].toString().padStart(7)).join("");
        lines.push(`${actual.padEnd(12)} ${row}`);
    });

    if (result.criticalErrors.length > 0) {
        lines.push("\n--- Critical Errors ---");
        lines.push(`Total: ${result.criticalErrors.length}`);
        const highSeverity = result.criticalErrors.filter(e => e.severity === "high");
        if (highSeverity.length > 0) {
            lines.push(`\nHigh Severity (Reversals): ${highSeverity.length}`);
            highSeverity.slice(0, 5).forEach(err => {
                lines.push(`  - [${err.commentId}] Expected: ${err.expected}, Got: ${err.predicted}`);
                lines.push(`    Text: "${err.text.slice(0, 80)}..."`);
            });
        }
    }

    return lines.join("\n");
}

/**
 * Create a sample test set for evaluation
 * (This would be replaced with real ground truth data)
 */
export function createSampleTestSet(): GroundTruthItem[] {
    return [
        {
            commentId: "test1",
            text: "完全に同意します！実践が大切ですね",
            expectedLabel: "Support",
            notes: "Direct agreement with creator's values",
        },
        {
            commentId: "test2",
            text: "理論も重要だと思います",
            expectedLabel: "Oppose",
            notes: "Defends what creator criticizes",
        },
        {
            commentId: "test3",
            text: "この本はどこで買えますか？",
            expectedLabel: "Neutral",
            notes: "On-topic but no stance",
        },
        {
            commentId: "test4",
            text: "初見です",
            expectedLabel: "Unknown",
            notes: "No clear relation to topic",
        },
        {
            commentId: "test5",
            text: "さすが！理論なしで成功できるなんて天才ですね（笑）",
            expectedLabel: "Oppose",
            notes: "Sarcastic praise = opposition",
        },
    ];
}
