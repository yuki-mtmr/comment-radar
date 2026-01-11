import { describe, it, expect, beforeEach } from "vitest";
import { MockEngine } from "../mock-engine";
import { generateMockComment } from "@/lib/mock-data/generators";
import type { YouTubeComment } from "@/types";

describe("MockEngine", () => {
  let engine: MockEngine;

  beforeEach(() => {
    engine = new MockEngine();
  });

  describe("analyzeComment", () => {
    it("should return sentiment analysis for a comment", async () => {
      const comment = generateMockComment("video123", {
        text: "This is amazing! Great tutorial.",
      });

      const result = await engine.analyzeComment(comment);

      expect(result.commentId).toBe(comment.id);
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.weightedScore).toBeGreaterThanOrEqual(-1);
      expect(result.weightedScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.emotions)).toBe(true);
      expect(result.emotions.length).toBeGreaterThan(0);
      expect(typeof result.isSarcasm).toBe("boolean");
    });

    it("should detect positive sentiment", async () => {
      const comment = generateMockComment("video123", {
        text: "This is amazing! Thank you so much! Excellent work!",
      });

      const result = await engine.analyzeComment(comment);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.emotions).toContain("enthusiastic");
    });

    it("should detect negative sentiment", async () => {
      const comment = generateMockComment("video123", {
        text: "This is terrible. Worst tutorial ever. Complete waste of time.",
      });

      const result = await engine.analyzeComment(comment);

      expect(result.score).toBeLessThan(-0.5);
      expect(result.emotions).toContain("frustrated");
    });

    it("should detect sarcasm", async () => {
      const comment = generateMockComment("video123", {
        text: "Oh wonderful, another basic tutorial. Very helpful indeed.",
      });

      const result = await engine.analyzeComment(comment);

      expect(result.isSarcasm).toBe(true);
      expect(result.score).toBeLessThan(0);
    });

    it("should calculate weighted score based on likes", async () => {
      const comment1 = generateMockComment("video123", {
        text: "Great video!",
        likeCount: 0,
      });

      const comment2 = generateMockComment("video123", {
        text: "Great video!",
        likeCount: 100,
      });

      const result1 = await engine.analyzeComment(comment1);
      const result2 = await engine.analyzeComment(comment2);

      // Comment with more likes should have higher weighted score
      expect(Math.abs(result2.weightedScore)).toBeGreaterThanOrEqual(
        Math.abs(result1.weightedScore)
      );
    });
  });

  describe("analyzeBatch", () => {
    it("should analyze multiple comments in a batch", async () => {
      const comments: YouTubeComment[] = [
        generateMockComment("video123", { text: "Great video!" }),
        generateMockComment("video123", { text: "Not very helpful." }),
        generateMockComment("video123", { text: "Okay content." }),
      ];

      const result = await engine.analyzeBatch({ comments });

      expect(result.analyses).toHaveLength(3);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.tokensUsed).toBeGreaterThan(0);

      result.analyses.forEach((analysis, idx) => {
        expect(analysis.commentId).toBe(comments[idx].id);
      });
    });

    it("should be faster than individual calls", async () => {
      const comments = Array.from({ length: 5 }, (_, i) =>
        generateMockComment("video123", { text: `Comment ${i}` })
      );

      // Batch analysis
      const batchStart = Date.now();
      await engine.analyzeBatch({ comments });
      const batchTime = Date.now() - batchStart;

      // Individual analysis
      const individualStart = Date.now();
      for (const comment of comments) {
        await engine.analyzeComment(comment);
      }
      const individualTime = Date.now() - individualStart;

      // Batch should be faster than individual calls
      expect(batchTime).toBeLessThan(individualTime);
    });

    it("should estimate token usage", async () => {
      const comments: YouTubeComment[] = [
        generateMockComment("video123", { text: "Short" }),
        generateMockComment("video123", {
          text: "This is a much longer comment with more words to analyze.",
        }),
      ];

      const result = await engine.analyzeBatch({ comments });

      expect(result.tokensUsed).toBeGreaterThan(0);
      // Longer text should result in more tokens
      expect(result.tokensUsed).toBeGreaterThan(comments[0].text.length);
    });
  });

  describe("configuration", () => {
    it("should use default configuration", () => {
      const config = engine.getConfig();

      expect(config.batchSize).toBe(50);
      expect(config.maxComments).toBe(500);
      expect(config.timeoutMs).toBe(5000);
    });

    it("should accept custom configuration", () => {
      const customEngine = new MockEngine({
        batchSize: 20,
        maxComments: 100,
      });

      const config = customEngine.getConfig();

      expect(config.batchSize).toBe(20);
      expect(config.maxComments).toBe(100);
      expect(config.timeoutMs).toBe(5000); // Default
    });

    it("should update configuration", () => {
      engine.updateConfig({ batchSize: 30 });

      const config = engine.getConfig();

      expect(config.batchSize).toBe(30);
      expect(config.maxComments).toBe(500); // Unchanged
    });
  });

  describe("sentiment scoring", () => {
    it("should handle neutral comments", async () => {
      const comment = generateMockComment("video123", {
        text: "This video covers the basics.",
      });

      const result = await engine.analyzeComment(comment);

      expect(result.score).toBeGreaterThan(-0.3);
      expect(result.score).toBeLessThan(0.3);
    });

    it("should amplify sentiment with exclamation marks", async () => {
      const comment1 = generateMockComment("video123", {
        text: "This is great",
      });

      const comment2 = generateMockComment("video123", {
        text: "This is great!!!",
      });

      const result1 = await engine.analyzeComment(comment1);
      const result2 = await engine.analyzeComment(comment2);

      expect(Math.abs(result2.score)).toBeGreaterThan(Math.abs(result1.score));
    });

    it("should clamp scores to valid range", async () => {
      const extremePositive = generateMockComment("video123", {
        text: "Amazing! Excellent! Perfect! Best! Wonderful! Great! Awesome! Love it!",
      });

      const extremeNegative = generateMockComment("video123", {
        text: "Terrible! Awful! Worst! Hate! Useless! Bad! Boring! Waste!",
      });

      const result1 = await engine.analyzeComment(extremePositive);
      const result2 = await engine.analyzeComment(extremeNegative);

      expect(result1.score).toBeLessThanOrEqual(1);
      expect(result2.score).toBeGreaterThanOrEqual(-1);
    });
  });
});
