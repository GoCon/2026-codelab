# quiz-app

Go Conference 2026 のコードラボ向け Go クイズアプリです。  
公開 UI は GitHub Pages に静的配信し、回答ログと問題ごとの正答率集計は Google Apps Script + Google スプレッドシートで扱います。

## 機能

- ランダムに選ばれた 5 問を出題
- 問題・選択肢・Go コードのシンタックスハイライト表示
- 回答後に正誤・解説・解答コード・Go Playground リンクを表示
- 全問正解でスペシャルページへのリンクを表示
- エクストラモードで未出問題へ継続挑戦、累計スコアを表示
- 旧 admin の問題一覧モードを公開 UI に統合
  - 初回ページで秘密のコードを入力すると解放
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
│       └── admin/
│           └── stats.go    # 互換用 stats API
├── gas/
│   └── telemetry.gs        # Apps Script の集計エンドポイント
├── internal/
│   ├── quizdata/           # 静的クイズデータ生成の共通処理
│   └── quizhandler/        # 互換用サーバーロジック
├── public/
│   ├── index.html          # 公開クイズ画面
│   ├── preview/index.html  # 解放後の問題一覧モード
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
Apps Script は `Logs` と `Summary` の 2 シートを自動で作成・更新します。

### 2. Apps Script を作成

1. スプレッドシートで **拡張機能 > Apps Script** を開く
2. `quiz-app/gas/telemetry.gs` の内容を貼り付ける
3. **デプロイ > 新しいデプロイ**
4. 種類を **ウェブアプリ** にする
5. 実行ユーザーを **自分**
6. アクセスできるユーザーを **全員**
7. 発行された Web アプリ URL を控える

受信 payload は以下のような JSON です。

```json
{
  "question_id": "alice_q1",
  "question_title": "range の仕様",
  "selected_answer": 1,
  "correct_answer": 1,
  "is_correct": true,
  "mode": "normal",
  "session_id": "....",
  "question_index": 3,
  "answered_at": "2026-04-15T12:34:56.000Z"
}
```

`Logs` シートには全回答が追記され、`Summary` シートには問題ごとの回答数・正答数・正答率が再計算されます。

## GitHub Pages workflow 設定

workflow: `.github/workflows/quiz-app-github-pages.yml`

GitHub の **Settings > Secrets and variables > Actions > Variables** に、必要に応じて次を追加してください。

| Variable 名 | 必須 | 説明 |
|---|---|---|
| `QUIZ_TELEMETRY_ENDPOINT` | 任意 | Apps Script の Web アプリ URL |
| `QUIZ_PREVIEW_UNLOCK_CODE` | 任意 | 初回ページで問題一覧モードを解放する秘密のコード |

- `QUIZ_TELEMETRY_ENDPOINT` が空でも GitHub Pages の静的サイトはデプロイされます
- `QUIZ_PREVIEW_UNLOCK_CODE` が空なら、問題一覧モードはエクストラモード全問正解でのみ解放されます

workflow は build 時に `gh-pages-dist/quiz-config.js` を上書きして、この設定を埋め込みます。

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

`make build-pages` または `make local` 実行時に静的データが再生成されます。
