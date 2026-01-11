"use client";

import { useState } from "react";
import { HeroSearch } from "@/components/hero-search";
import { VideoInfoCard } from "@/components/video-info-card";
import { SentimentDonutChart } from "@/components/charts/sentiment-donut-chart";
import { TimeScatterPlot } from "@/components/charts/time-scatter-plot";
import { SentimentTimeline } from "@/components/charts/sentiment-timeline";
import { CommentList } from "@/components/comment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { VideoAnalysis } from "@/types";
import { toast } from "sonner";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/cache/analysis-cache";

export default function Home() {
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    /* Temporarily disabled cache to ensure logic updates are visible
    const cached = getCachedAnalysis(url);
    if (cached) {
      setAnalysis(cached);
      setIsLoading(false);
      toast.success("Loaded from cache", { duration: 2000 });
      return;
    }
    */

    toast.loading("Analyzing video comments...", { id: "analysis" });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, maxComments: 25 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze video");
      }

      const data: VideoAnalysis = await response.json();
      setAnalysis(data);

      // Cache the result
      setCachedAnalysis(url, data);

      toast.success(
        `Analysis complete! Analyzed ${data.comments.length} comments.`,
        { id: "analysis" }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage, { id: "analysis" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <HeroSearch onSearch={handleSearch} isLoading={isLoading} />

      {error && (
        <Card className="glass-dark border-red-500/50">
          <CardContent className="p-6">
            <p className="text-red-400 text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </div>
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      )}

      {analysis && !isLoading && (
        <>
          <VideoInfoCard {...analysis.video} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentDonutChart
              positive={analysis.distribution.positive}
              neutral={analysis.distribution.neutral}
              negative={analysis.distribution.negative}
            />
            <SentimentTimeline data={analysis.timeline} />
          </div>

          <TimeScatterPlot data={analysis.scatterData} />

          <CommentList comments={analysis.comments} maxDisplay={20} />
        </>
      )}
    </div>
  );
}
