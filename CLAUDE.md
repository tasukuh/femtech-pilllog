# CLAUDE.md

> このファイルは Claude Code が自動的に読み込みます。プロジェクトの「働き方の取り決め」と「重要な参照先」を簡潔に伝えるための場所です。

---

## このプロジェクトについて

**Femtech 3-App Strategy** — 「1アプリ1機能」で勝負する、ピル管理・婦人科受診ノート・運動×周期の3アプリを Expo で連続的に開発します。

- 開発順序: ピルログ → シグナルノート → フェムラン
- 共通スタック: Expo + TypeScript + expo-sqlite + RevenueCat + PostHog + Claude API
- バックエンド: 健康データは完全ローカル保存、AIプロキシのみ Vercel Edge Function

詳細は `../femtech-workspace/docs/00_strategy.md` を参照。

---

## あなたへの期待

**Tasuku（依頼者）の前提**:
- TypeScript / React / Next.js / Supabase に習熟
- 過去にWeb版で「車輪の再開発を防ぐパターン集」を作成済み（`../femtech-workspace/patterns/legacy/`）
- マルチエージェント Claude Code環境で並列実行に慣れている
- UI/UXの品質に強いこだわりがある

**あなたが取るべき態度**:
- 説明より実装を優先する。設計選択肢を3つ並べる必要はない、1つに決めて根拠を1行で添える
- 既存パターン集（`../femtech-workspace/patterns/legacy/`）から流用できる箇所を必ず先に探す
- 不明な仕様は推測せず、仕様書のどこを参照すべきかを質問する
- 「とりあえず動く」より「仕様書通り」を優先

---

## 必読ドキュメント（着手前）

新しい作業を始める前に **必ずこの順番で読む**:

1. `../femtech-workspace/docs/99_shared_foundations.md` — 3アプリ共通の技術・デザイン・法的基盤
2. 該当アプリの仕様書 — `../femtech-workspace/docs/01_pilllog.md` / `../femtech-workspace/docs/02_signal_note.md` / `../femtech-workspace/docs/03_femrun.md`
3. `../femtech-workspace/patterns/web-to-rn-translation.md` — Web向けパターン → React Native への翻訳ルール
4. `../femtech-workspace/patterns/rn-essentials.md` — React Native 固有のパターン

これらを読まずに実装を始めない。

---

## コーディング規約

### 言語・ファイル
- TypeScript strict モード必須
- ファイル名: `kebab-case.ts` / コンポーネントは `PascalCase.tsx`
- import 順: 外部ライブラリ → `@/lib` → `@/components` → 相対パス

### 命名
- 関数: `camelCase` 動詞始まり（`createDoseRecord`, `getEnergyScore`）
- 型: `PascalCase`、Props型は `XxxProps`
- DB操作関数: `lib/db/queries/{domain}.ts` に集約

### コミット
Conventional Commits 必須:
- `feat:` 新機能
- `fix:` バグ修正
- `refactor:` 内部リファクタ
- `docs:` ドキュメント
- `test:` テスト
- `chore:` 雑務（依存関係更新等）

---

## 絶対遵守ルール

### やってはいけないこと
- ❌ サーバーAPIエンドポイントを作る（健康データは完全ローカル）
- ❌ `ANTHROPIC_API_KEY` をクライアントコードに含める
- ❌ `localStorage` / `AsyncStorage` に健康データを保存（必ず expo-sqlite）
- ❌ PostHogイベントに健康データの中身を含める（イベント名のみ）
- ❌ 「診断」「治療」という言葉を医療文脈で使う
- ❌ 6画面以上のオンボーディングを作る
- ❌ 起動時・オンボーディング中にペイウォール表示
- ❌ デザイントークン外の色をハードコード

### 必ずやること
- ✅ DBアクセスは `lib/db/queries/` 経由のみ
- ✅ AI呼び出しは `lib/ai/` 経由のみ
- ✅ デザイントークン（`design-tokens.ts`）参照
- ✅ AI出力画面には「医療アドバイスではない」明示
- ✅ 全コンポーネントに `accessibilityLabel`

---

## 開発フロー

### 新しいアプリを始めるとき
1. `../femtech-workspace/prompts/new-app.md` を参照
2. Expoプロジェクト初期化
3. `../femtech-workspace/docs/99_shared_foundations.md` の「ファイル構造」を再現
4. 該当アプリ仕様書の Phase 1 から着手

### 新しい機能を追加するとき
1. `../femtech-workspace/prompts/new-feature.md` を参照
2. 仕様書の該当セクションを引用しながら計画提示
3. 受け入れ基準（仕様書 第12章相当）を最初に確認
4. 実装 → セルフチェック

### バグを修正するとき
1. 仕様書のどこと違うかを特定（仕様 vs 実装）
2. 再現手順を明確化
3. 修正 + テスト追加

---

## 利用可能なMCPツール

このプロジェクトでは以下のMCPを活用:
- **context7**: Expo・RevenueCat・React Native ライブラリの最新ドキュメント取得
- **filesystem**: プロジェクトファイル操作
- 各種MCPは必要に応じて呼び出す

最新のライブラリ仕様を確認したい時は **必ず context7 を使う**。記憶やWeb検索より context7 が正確。

---

## 並列実行の方針

大きな独立タスクは sub-agent で並列処理する:
- 例: 「複数画面のUIコンポーネントを同時実装」
- 例: 「DBクエリ層と通知層を並列で書く」

ただし、相互依存があるタスク（DBスキーマ → クエリ → UI）は逐次実行。

---

## モデル使い分け

- 長文・構造化ドキュメント生成: **Sonnet**
- 高度な論理構造化（アーキ判断、複雑なバグ調査）: **Opus**
- 単純な反復タスク（リネーム、フォーマット）: **Haiku**

---

## 質問するときの作法

不明点があれば以下のフォーマットで質問:

```
[QUESTION]
コンテキスト: 何をしようとしているか
不明点: 何がわからないか
仕様書の該当箇所: docs/XX_xxx.md の第X章
選択肢: 候補があれば3つまで
```

このフォーマットを守ることで、Tasukuが30秒で意思決定できる。

---

## このCLAUDE.mdの更新

実装中に「ここをルール化したい」と思ったら、このファイルを直接更新する。ただし、3アプリで一貫した変更にすること（個別アプリだけの例外は作らない）。
