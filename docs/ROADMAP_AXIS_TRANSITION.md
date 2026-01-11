# Axis-Based Sentiment Analysis Transition Roadmap

動画ごとに定義した「主軸（Axis）」に対する賛否判定（Stance Analysis）への移行プラン。

## 0. 目的
- 「Creatorへの感情」から「主張（Axis）への賛否」へのパラダイムシフト。
- 返信スレッドにおける「反転ロジック」の正確な実装。
- 不明瞭な文脈における `Unknown` 状態の許容による精度の向上。

---

## Phase 1: データスキーマの拡張と Axis 基盤の構築
**目標**: 判定基準（Axis Profile）を生成し、新しい判定ラベルを扱えるようにする。

### 1.1 型定義の更新 (`src/types/index.ts`, `src/lib/engine/types.ts`)
- `AxisProfile` 型の追加。
- `SentimentAnalysis` インターフェースに `label`, `confidence`, `axisEvidence`, `replyRelation`, `speechAct` を追加。

### 1.2 Axis Profile 生成ロジックの実装 (`src/lib/engine/groq-engine.ts`)
- `generateContextSummary` を拡張し、構造化された `AxisProfile` を返すように変更（または専用メソッド `generateAxisProfile` の作成）。

### 1.3 改修プロンプトの設計 (`src/lib/llm/prompts.ts`)
- `SYSTEM_PROMPT` を Axis ベースに刷新。
- `createBatchPrompt` が `AxisProfile` を受け取り、各コメントに `label` や `replyRelation` を出力するように指示。

---

## Phase 2: 分析エンジンとバッチ処理の改修
**目標**: 新プロンプトを用いた実機（Groq/Llama-70b）での動作確認とパース処理の強化。

### 2.1 エンジン実装の更新 (`src/lib/engine/groq-engine.ts`)
- `analyzeBatch` 内で `AxisProfile` をプロンプトに注入。
- 新しいレスポンス形式（`label`, `replyRelation` 等）のパースとマッピング。
- スコア変換テーブルによる後方互換性（`label` -> `score`）の維持。

### 2.2 テストコードの作成 (`src/lib/engine/__tests__/axis-logic.test.ts`)
- 教育動画、批判動画、皮肉を含むコメントのモックデータを用いて、期待通りのラベルが返るか検証。

---

## Phase 3: 返信（Thread-aware）ロジックの統合
**目標**: 親コメントの stance と返信の `replyRelation` を合成して最終的な stance を決定する。

### 3.1 Stance 合成ロジックの実装
- 返信コメントの最終 `label` を決定する純粋関数を作成：
  - `(parentLabel, replyRelation) => finalLabel`
  - 例: `(Oppose, disagree) => Support`

### 3.2 バッチ処理での順序解決
- 親コメントが同じバッチ内にいる場合の処理順序、または 2パス（全判定 -> 返信補正）処理の導入。

---

## Phase 4: UI/UX と 評価
**目標**: 4分類表示の対応と、精度の定量的評価。

### 4.1 フロントエンド表示の更新
- スコアバーだけでなく、`Support / Oppose / Neutral / Unknown` のラベル表示。
- `axisEvidence`（判定の根拠）のツールチップ表示。

### 4.2 精度評価（Evaluation）
- 200件程度のテストセットでの Accuracy 測定。
- 致命的な「逆判定」のログ収集とプロンプトの微調整。

---

## ファイル変更リスト（想定）
1. `src/types/index.ts`: 型定義 (SentimentAnalysis, AxisProfile)
2. `src/lib/engine/types.ts`: Engine Interface 更新
3. `src/lib/engine/groq-engine.ts`: 分析ロジック, プロンプト注入, パース
4. `src/lib/llm/prompts.ts`: プロンプトテンプレート (System/User)
5. `src/lib/engine/factory.ts`: (必要に応じて) インスタンス化の変更
