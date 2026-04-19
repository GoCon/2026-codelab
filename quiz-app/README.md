# quiz-app

Go Conference 2026 のコードラボ向け Go クイズアプリです。  
公開 UI は GitHub Pages に静的配信し、回答ログと問題ごとの正答率集計は Google Apps Script + Google スプレッドシートで扱います。

## 機能

- ランダムに選ばれた 5 問を出題
- 問題ごとに `normal` / `extra` / `both` の出題プールを持てる
- 問題・選択肢・Go コードのシンタックスハイライト表示
- 選択肢順は出題ごとにランダムシャッフル
- 回答後に正誤・解説・解答コード・Go Playground リンクを表示
- 全問正解でスペシャルページへのリンクを表示
- 回答開始からの経過秒数を計測し、全問正解時はクリアタイム表示とニックネーム送信が可能
- エクストラモードで未出問題へ継続挑戦、累計スコアを表示
- 問題プレビューモードを公開 UI に統合
  - フッターを 10 回タップすると hidden Keyword ポップアップが開き、Keyword で問題プレビューモードを開ける
  - またはエクストラモード全問正解で解放
- 回答イベントを Google Apps Script に送信し、スプレッドシートで問題ごとの集計を更新

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | バニラ HTML/CSS/JS、[highlight.js](https://highlightjs.org/) |
| 静的データ生成 | Go |
| ホスティング | GitHub Pages |
| 集計 | Google Apps Script + Google スプレッドシート |
| ローカル開発 | 標準 Go HTTP サーバー |
| 互換用ビルド | Go + TinyGo + Cloudflare Pages Functions |

## ディレクトリ構成

```text
quiz-app/
├── cmd/
│   ├── generatequizdata/   # quizes.yaml から quiz-data.js を生成
│   └── local/              # ローカル開発用サーバー
├── functions/
│   └── api/
│       ├── quizes.yaml     # 問題データ
│       ├── code/           # 問題・解答コード
│       ├── quiz.go         # 互換用 quiz API (Cloudflare Pages Functions)
├── gas/
│   └── telemetry.gs        # Apps Script の集計エンドポイント
├── internal/
│   ├── quizdata/           # 静的クイズデータ生成の共通処理
│   └── quizhandler/        # 互換用サーバーロジック
├── public/
│   ├── index.html          # 公開クイズ画面
│   ├── preview/index.html  # 解放後の問題プレビューモード
│   └── quiz-config.js      # telemetry / 秘密コード設定
├── Makefile
└── go.mod
```

## ローカル開発

> Go 1.25 以上が必要です。

```bash
cd quiz-app
make local
# http://localhost:8788
```

`make local` は `public/` を配信しつつ、`/quiz-data.js` を動的生成します。  
`PORT=3000 make local` のようにポート変更も可能です。

## GitHub Pages 用の静的ビルド

```bash
cd quiz-app
make build-pages
```

成果物は `gh-pages-dist/` に出力されます。

```text
gh-pages-dist/
├── index.html
├── preview/index.html
├── quiz-config.js
└── quiz-data.js
```

`quiz-data.js` は `functions/api/quizes.yaml` と `functions/api/code/*` から生成されます。

## Google Apps Script + スプレッドシート設定

### 1. スプレッドシートを作成

任意の Google スプレッドシートを 1 つ用意します。  
Apps Script は `Logs`、`Summary`、`Attempts`、`PerfectScores` の 4 シートを自動で作成・更新します。

### 2. Apps Script を作成

1. スプレッドシートで **拡張機能 > Apps Script** を開く
2. `quiz-app/gas/telemetry.gs` の内容を貼り付ける
3. **デプロイ > 新しいデプロイ**
4. 種類を **ウェブアプリ** にする
5. 実行ユーザーを **自分**
6. アクセスできるユーザーを **全員**
7. 発行された Web アプリ URL を控える

回答ログは以下のような JSON です。

```json
{
  "event_type": "answer",
  "question_id": "alice_q1",
  "question_title": "range の仕様",
  "selected_answer": 1,
  "correct_answer": 1,
  "selected_display_index": 2,
  "correct_display_index": 2,
  "selected_choice_text": "for range",
  "correct_choice_text": "for range",
  "choice_order": [3, 0, 1, 2],
  "is_correct": true,
  "mode": "normal",
  "session_id": "same-browser-session-id",
  "attempt_id": "single-quiz-run-id",
  "question_index": 3,
  "session_size": 5,
  "elapsed_seconds": 42,
  "question_elapsed_seconds": 11,
  "answered_at": "2026-04-15T12:34:56.000Z"
}
```

- `session_id`: 同じブラウザセッション内の再挑戦をまたいで共通の ID
- `attempt_id`: 1 回の 5 問チャレンジごとに新しく採番される ID
- `selected_answer` / `correct_answer`: `quizes.yaml` 上の元の選択肢 index
- `selected_display_index` / `correct_display_index`: シャッフル後に画面へ表示された index
- `choice_order`: 表示順から元の index への対応（例: `[3,0,1,2]` は「表示1番目=元の4番目」）

全問正解時にニックネーム送信用フォームから送られる payload は以下です。

```json
{
  "event_type": "perfect_score",
  "nickname": "gopher",
  "elapsed_seconds": 42,
  "completed_at": "2026-04-15T12:39:56.000Z",
  "mode": "extra",
  "session_id": "same-browser-session-id",
  "attempt_id": "single-quiz-run-id"
}
```

- `Logs` シートには全回答が追記され、`session_id`、`attempt_id`、各回答時点の `elapsed_seconds`、各問題にかかった `question_elapsed_seconds` に加えて、元の選択肢 index / 表示 index / 選択肢テキスト / `choice_order` が保存されます
- `Summary` シートには問題ごとの **初回回答時の正答率** と **最終回答時の正答率**、および初回/最終回答時点の平均所要秒数が再計算されます
- `Attempts` シートには各 `attempt_id` ごとの回答数、完走有無、最後に到達した問題番号、総経過秒数がまとまり、途中離脱の分析に使えます
- `PerfectScores` シートには全問正解時に送信されたニックネーム、クリアタイム、回答完了日時、`mode`（`normal` / `extra`）、`attempt_id` が追記されます

## GitHub Pages デプロイについて

GitHub Pages 向けの静的成果物は `make build-pages` で生成できますが、**公開日までは自動デプロイ workflow を無効化**しています。

再度 GitHub Pages 自動公開を有効にする場合は、workflow で次の Variables を使う想定です。

| Variable 名 | 必須 | 説明 |
|---|---|---|
| `QUIZ_TELEMETRY_ENDPOINT` | 任意 | Apps Script の Web アプリ URL（未設定時は `public/quiz-config.js` の既定値を使用） |
| `QUIZ_PREVIEW_UNLOCK_CODE` | 任意 | フッター 10 タップ後に開く hidden Keyword ポップアップで使うコード（未設定時は `gofar,gotogether`） |

- `QUIZ_TELEMETRY_ENDPOINT` が空でも静的サイト自体はビルドでき、`public/quiz-config.js` に含まれる既定の Apps Script URL が使われます
- `QUIZ_PREVIEW_UNLOCK_CODE` を未設定のまま使う場合、既定の hidden Keyword は `gofar,gotogether` です
 
再度 workflow を作る場合は、build 時に `public/quiz-config.js` の既定値を読み込み、Actions Variables が設定されている項目だけ `gh-pages-dist/quiz-config.js` へ上書きする運用を想定しています。

## 旧 Cloudflare Functions ビルド

互換確認用に、従来の Cloudflare Pages Functions 向けビルドも残しています。

```bash
cd quiz-app
make build GO=/usr/lib/go-1.22/bin/go
```

> TinyGo 0.40.1 は Go 1.26 を直接サポートしないため、環境によっては `GO=/usr/lib/go-1.22/bin/go` のように指定してください。

## テスト

```bash
cd quiz-app
go test ./...
make test-browser
```

## 問題の追加方法

### 1. コードファイルを配置

`functions/api/code/` に Go ファイルを追加します。

```go
//go:build ignore

package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
```

`//go:build ignore` は公開用コード表示時に自動で除去されます。

### 2. `quizes.yaml` に問題を追加

```yaml
- id: "author_q1"
  title: "問題のタイトル"
  text: "問題文"
  mode: "extra"
  question_code_ref: "code/author_q1_question.go"
  choices:
    - "選択肢 A"
    - "選択肢 B"
    - "選択肢 C"
    - "選択肢 D"
  answer: 2
  explanation: "解説文"
  answer_code_ref: "code/author_q1_answer.go"
  answer_code_play_ref: "https://go.dev/play/p/..."
```

`mode` は省略可能です。値は次の 3 つです。

- `both`（既定値）: ノーマル / エクストラの両方で出題候補に入る
- `normal`: ノーマルモードのみで出題する
- `extra`: エクストラモードのみで出題する

`answer` は **元の choices 配列に対する正解 index** を指定します。公開 UI 側では表示時に choices をシャッフルしますが、telemetry には元 index と表示 index の両方が送られます。

`make build-pages` または `make local` 実行時に静的データが再生成されます。
