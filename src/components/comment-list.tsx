"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, AlertCircle, Smile, Frown, Meh, HelpCircle, Target } from "lucide-react";

import { useLanguage } from "@/lib/i18n/context";
import type { StanceLabel } from "@/types";

interface Comment {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  sentiment: number; // -1.0 to 1.0
  emotions: string[];
  isSarcasm: boolean;
  // New axis-based fields
  label?: StanceLabel;
  confidence?: number;
  axisEvidence?: string;
  replyRelation?: string;
}

interface CommentListProps {
  comments: Comment[];
  maxDisplay?: number;
}

export function CommentList({ comments, maxDisplay = 10 }: CommentListProps) {
  const { language, t } = useLanguage();
  const displayComments = comments.slice(0, maxDisplay);

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.3) return <Smile className="w-4 h-4 text-sentiment-positive" />;
    if (sentiment < -0.3) return <Frown className="w-4 h-4 text-sentiment-negative" />;
    return <Meh className="w-4 h-4 text-sentiment-neutral" />;
  };

  const getSentimentLabel = (sentiment: number): string => {
    if (sentiment > 0.3) return t.charts.positive;
    if (sentiment < -0.3) return t.charts.negative;
    return t.charts.neutral;
  };

  const getSentimentColor = (sentiment: number): string => {
    if (sentiment > 0.3) return "bg-sentiment-positive/20 text-sentiment-positive border-sentiment-positive/30";
    if (sentiment < -0.3) return "bg-sentiment-negative/20 text-sentiment-negative border-sentiment-negative/30";
    return "bg-sentiment-neutral/20 text-sentiment-neutral border-sentiment-neutral/30";
  };

  // NEW: Stance label helpers
  const getStanceIcon = (label: StanceLabel) => {
    switch (label) {
      case "Support":
        return <Target className="w-4 h-4 text-green-500" />;
      case "Oppose":
        return <Frown className="w-4 h-4 text-red-500" />;
      case "Neutral":
        return <Meh className="w-4 h-4 text-gray-400" />;
      case "Unknown":
        return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStanceLabel = (label: StanceLabel): string => {
    const labels = {
      Support: language === "ja" ? "賛成" : "Support",
      Oppose: language === "ja" ? "反対" : "Oppose",
      Neutral: language === "ja" ? "中立" : "Neutral",
      Unknown: language === "ja" ? "不明" : "Unknown",
    };
    return labels[label];
  };

  const getStanceColor = (label: StanceLabel): string => {
    switch (label) {
      case "Support":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Oppose":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "Neutral":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "Unknown":
        return "bg-gray-600/20 text-gray-500 border-gray-600/30";
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (language === "ja") {
      if (diffDays > 0) return `${diffDays}日前`;
      if (diffHours > 0) return `${diffHours}時間前`;
      if (diffMins > 0) return `${diffMins}分前`;
      return "たった今";
    }

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  };

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="gradient-text">{t.comments.topComments}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {language === "ja"
            ? `${comments.length}件中${displayComments.length}件を表示中`
            : `Showing ${displayComments.length} of ${comments.length} comments`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayComments.map((comment) => (
            <div
              key={comment.id}
              className="glass rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                    {comment.author.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{comment.author}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(comment.publishedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* Show stance label if available (Axis-based analysis) */}
                  {comment.label ? (
                    <>
                      {getStanceIcon(comment.label)}
                      <Badge
                        variant="outline"
                        className={`${getStanceColor(comment.label)} text-xs`}
                        title={comment.axisEvidence || "Stance toward video's main axis"}
                      >
                        {getStanceLabel(comment.label)}
                        {comment.confidence && (
                          <span className="ml-1 opacity-70">
                            {Math.round(comment.confidence * 100)}%
                          </span>
                        )}
                      </Badge>
                    </>
                  ) : (
                    /* Fallback to sentiment if no stance label */
                    <>
                      {getSentimentIcon(comment.sentiment)}
                      <Badge
                        variant="outline"
                        className={`${getSentimentColor(comment.sentiment)} text-xs`}
                      >
                        {getSentimentLabel(comment.sentiment)}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Comment Text */}
              <p className="text-sm mb-3 leading-relaxed">{comment.text}</p>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {comment.likeCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{comment.likeCount}</span>
                    </div>
                  )}
                  {comment.isSarcasm && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30"
                    >
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {t.comments.sarcasm}
                    </Badge>
                  )}
                  {comment.replyRelation && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30"
                      title="Relation to parent comment"
                    >
                      ↳ {comment.replyRelation}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {comment.emotions.slice(0, 3).map((emotion, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs py-0 px-2"
                    >
                      {emotion}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
