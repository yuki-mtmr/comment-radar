# Axis-Based Stance Analysis - Implementation Complete

**実装日**: 2026-01-11
**ステータス**: ✅ 全フェーズ完了

## 概要

従来の「クリエイターへの感情」ベースから「主張（Axis）への賛否判定」へのパラダイムシフトが完了しました。

## 実装済み機能

### Phase 1: データスキーマ拡張 ✅

#### 1.1 型定義の更新
**ファイル**: [src/types/index.ts](../src/types/index.ts)

新規追加された型:
- `StanceLabel`: "Support" | "Oppose" | "Neutral" | "Unknown"
- `ReplyRelation`: "agree" | "disagree" | "clarify" | "question" | "unrelated"
- `SpeechAct`: "assertion" | "question" | "joke" | "sarcasm" | "insult" | "praise" | "other"
- `AxisProfile`: 動画ごとの主軸プロファイル

`SentimentAnalysis`インターフェースに追加されたフィールド:
```typescript
label?: StanceLabel;
confidence?: number;
axisEvidence?: string;
replyRelation?: ReplyRelation;
speechAct?: SpeechAct;
```

#### 1.2 Axis Profile 生成ロジック
**ファイル**: [src/lib/engine/groq-engine.ts](../src/lib/engine/groq-engine.ts)

`GroqEngine.generateAxisProfile()` メソッド:
- 動画のタイトル、説明、トランスクリプトから主軸を抽出
- 構造化された `AxisProfile` を生成
- フォールバック処理によるロバスト性確保

#### 1.3 新プロンプト設計
**ファイル**: [src/lib/llm/prompts.ts](../src/lib/llm/prompts.ts)

新規追加:
- `AXIS_SYSTEM_PROMPT`: Axis-based分析専用システムプロンプト
- `createAxisBatchPrompt()`: AxisProfileを注入したバッチプロンプト

主要な特徴:
- 主張への賛否を4分類（Support/Oppose/Neutral/Unknown）
- 返信関係の分析（agree/disagree/clarify/question/unrelated）
- 判定根拠の明示（axisEvidence）

---

### Phase 2: エンジン改修 ✅

#### 2.1 新レスポンス形式のパース
**ファイル**: [src/lib/engine/groq-engine.ts](../src/lib/engine/groq-engine.ts)

`GroqEngine.analyzeAxisBatch()` メソッド:
- 新しい`AxisGroqResponse`インターフェース
- `label`, `confidence`, `axisEvidence`, `replyRelation`, `speechAct`のパース
- Label→Score変換による後方互換性（`labelToScore()`）

#### 2.2 テストコード
**ファイル**: [src/lib/engine/__tests__/axis-logic.test.ts](../src/lib/engine/__tests__/axis-logic.test.ts)

テストケース:
- ラベル→スコア変換の検証
- Stance合成ロジックの検証
- 教育動画シナリオ（実践 vs 理論）
- 批判動画シナリオ（政治家への批判）
- スレッド対応（親・子コメントの関係）

---

### Phase 3: Thread-Aware ロジック ✅

#### 3.1 Stance合成ロジック
**ファイル**: [src/lib/engine/stance-logic.ts](../src/lib/engine/stance-logic.ts)

`synthesizeStance()` 関数:
```typescript
(parentLabel: StanceLabel, replyRelation: ReplyRelation) => StanceLabel
```

反転ロジックの例:
- `(Oppose, disagree) => Support` （二重否定）
- `(Support, agree) => Support` （強化）
- `(Support, disagree) => Oppose` （矛盾）

ユーティリティ関数:
- `labelToScore()`: StanceLabel → SentimentScore変換
- `scoreToLabel()`: SentimentScore → StanceLabel変換
- `applyStanceSynthesis()`: バッチ全体への合成適用
- `sortCommentsByThreadOrder()`: 親コメント優先ソート

#### 3.2 2パスバッチ処理
**ファイル**: [src/lib/engine/groq-engine.ts](../src/lib/engine/groq-engine.ts)

`analyzeAxisBatch()`での処理フロー:
1. **Pass 1**: コメントをスレッド順にソート（親→子）
2. **LLM分析**: 各コメントの初期stanceを判定
3. **Pass 2**: `applyStanceSynthesis()`で返信の最終stanceを決定
4. **再計算**: weighted scoreを更新

---

### Phase 4: UI/UX更新 ✅

#### 4.1 フロントエンド表示
**ファイル**: [src/components/comment-list.tsx](../src/components/comment-list.tsx)

新機能:
- 4分類ラベル表示（Support/Oppose/Neutral/Unknown）
- 日英バイリンガル対応（賛成/反対/中立/不明）
- 信頼度スコア表示（confidence %）
- 返信関係バッジ（↳ agree/disagree）
- axisEvidenceのtitle属性（ホバー表示）

視覚的改善:
- アイコン: Support → 🎯 (Target), Oppose → 😞 (Frown), Neutral → 😐 (Meh), Unknown → ❓ (HelpCircle)
- 色分け: 緑（Support）、赤（Oppose）、グレー（Neutral/Unknown）

#### 4.2 精度評価システム
**ファイル**: [src/lib/engine/evaluation.ts](../src/lib/engine/evaluation.ts)

`evaluateStanceAccuracy()` 関数:
- 正解率（Accuracy）計算
- 混同行列（Confusion Matrix）生成
- Per-Label メトリクス（Precision, Recall, F1-Score）
- 重大エラー検出（Support ↔ Oppose の逆判定）

`generateEvaluationReport()` 関数:
- 人間が読める評価レポート生成
- 重大エラーのハイライト
- Top-5エラーの詳細表示

**テストファイル**: [src/lib/engine/__tests__/evaluation.test.ts](../src/lib/engine/__tests__/evaluation.test.ts)

---

## 使用方法

### 1. Axis Profile の生成

```typescript
const engine = new GroqEngine(apiKey);
const axisProfile = await engine.generateAxisProfile({
  id: videoId,
  title: "実践的な学び vs 座学",
  channelName: "教育チャンネル",
  description: "...",
  transcript: "..."
});
```

### 2. Axis-Based 分析の実行

```typescript
const result = await engine.analyzeAxisBatch(
  {
    comments: youtubComments,
    videoContext: { title, channelName, summary }
  },
  axisProfile
);

// result.analyses に label, confidence, axisEvidence が含まれる
```

### 3. 精度評価

```typescript
import { evaluateStanceAccuracy, generateEvaluationReport } from '@/lib/engine/evaluation';

const groundTruth = [
  { commentId: "1", text: "...", expectedLabel: "Support" },
  // ...
];

const evalResult = evaluateStanceAccuracy(predictions, groundTruth);
console.log(generateEvaluationReport(evalResult));
```

---

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                     YouTube Video                           │
│  (Title, Description, Transcript)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ generateAxisProfile() │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │     AxisProfile       │
         │ • mainAxis            │
         │ • creatorPosition     │
         │ • targetOfCriticism   │
         │ • supportedValues     │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  analyzeAxisBatch()   │
         │  (LLM Analysis)       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Initial Analyses     │
         │  (label, replyRelation)│
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ applyStanceSynthesis()│
         │  (Thread-aware)       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Final Analyses       │
         │  • label (Support/...)│
         │  • confidence         │
         │  • axisEvidence       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Frontend Display    │
         │  (4-category badges)  │
         └───────────────────────┘
```

---

## 今後の拡張可能性

### 優先度: 高
- [ ] 実際の動画データでの評価（200件テストセット）
- [ ] Groq API以外のエンジン対応（Gemini, OpenAI）
- [ ] axisEvidenceのtooltip表示（shadcn/uiのTooltipコンポーネント追加）

### 優先度: 中
- [ ] Axis Profileのキャッシュ機能
- [ ] リアルタイム精度モニタリングダッシュボード
- [ ] マルチ言語対応の拡張（EN/JA以外）

### 優先度: 低
- [ ] カスタムAxis Profile編集UI
- [ ] A/Bテスト機能（旧Sentiment vs 新Axis）
- [ ] エクスポート機能（CSV, JSON）

---

## 変更されたファイル一覧

### 型定義
- ✅ `src/types/index.ts`
- ✅ `src/lib/engine/types.ts`

### コアロジック
- ✅ `src/lib/engine/groq-engine.ts`
- ✅ `src/lib/engine/stance-logic.ts` (新規)
- ✅ `src/lib/llm/prompts.ts`

### テスト
- ✅ `src/lib/engine/__tests__/axis-logic.test.ts` (新規)
- ✅ `src/lib/engine/__tests__/evaluation.test.ts` (新規)

### 評価ツール
- ✅ `src/lib/engine/evaluation.ts` (新規)

### UI
- ✅ `src/components/comment-list.tsx`

### ドキュメント
- ✅ `docs/AXIS_IMPLEMENTATION_COMPLETE.md` (本ファイル)

---

## 技術的ハイライト

### 1. 後方互換性
既存の`score`ベースのシステムと完全互換:
- `label`が存在しない場合は従来のsentiment表示
- `labelToScore()`による自動変換
- 既存のUIコンポーネントがそのまま動作

### 2. ロバスト性
- フォールバック処理（API失敗時）
- 不明瞭なコメントへの`Unknown`ラベル許容
- 親コメント不在時のgraceful degradation

### 3. スケーラビリティ
- バッチ処理（20件/call）による効率化
- 2パス処理でもO(n)の計算量
- キャッシュ可能な`AxisProfile`

---

## 謝辞

本実装は [ROADMAP_AXIS_TRANSITION.md](./ROADMAP_AXIS_TRANSITION.md) の設計に基づいています。

---

**実装完了日**: 2026-01-11
**実装者**: Claude Sonnet 4.5
**レビュー状態**: 実装完了、実機テスト待ち
