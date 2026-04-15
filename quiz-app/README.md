# quiz-app

Go Conference 2026 のコードラボ向け Go クイズアプリです。  
公開クイズ UI は GitHub Pages でも配信でき、API・admin は Cloudflare Pages + D1 + TinyGo (WebAssembly) で動作します。

## 機能

- ランダムに選ばれた 5 問を出題 (セッション単位でユニーク)
- 問題・選択肢・Go コードのシンタックスハイライト表示
- 回答後に正誤・解説・解答コードを表示
- 全問正解でスペシャルページへのリンクを表示
- チャレンジモード: 既出問題を除いた全問に挑戦、累計スコア表示
- 管理画面 (`/admin`): 問題ごとの正答率集計・問題内容プレビュー

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | バニラ HTML/CSS/JS、[highlight.js](https://highlightjs.org/) |
| API (WebAssembly) | Go 1.25 + [TinyGo 0.40.1](https://tinygo.org/) |
| Workers ランタイム | [syumai/workers](https://github.com/syumai/workers) |
| データベース | Cloudflare D1 (SQLite 互換) |
| ホスティング | GitHub Pages (公開 UI) / Cloudflare Pages (API・admin) |
| インフラ管理 | Terraform (Cloudflare Provider) |
| ローカル開発 | 標準 Go HTTP サーバー (インメモリ DB) |

## ディレクトリ構成

```
quiz-app/
├── cmd/local/          # ローカル開発用 Go HTTP サーバー
├── functions/
│   └── api/
│       ├── quiz.go         # クイズ API (WASM エントリーポイント)
│       ├── quizes.yaml     # 問題データ
│       ├── code/           # 問題・解答コードファイル
│       └── admin/
│           └── stats.go    # 管理 API (WASM エントリーポイント)
├── internal/
│   └── quizhandler/
│       ├── handler.go      # ビジネスロジック
│       └── handler_test.go
├── public/
│   ├── index.html          # クイズ画面
│   ├── quiz-config.js      # 公開 UI の API 接続先設定
│   └── admin/index.html    # 管理画面
├── terraform/              # Cloudflare インフラ定義
├── schema.sql              # D1 テーブル定義
├── wrangler.toml           # Cloudflare Pages 設定
├── Makefile
└── go.mod
```

## ローカル開発

> Go 1.25 が必要です。[https://go.dev/dl/](https://go.dev/dl/) からインストールしてください。

```bash
cd quiz-app
make local
# http://localhost:8788 でアクセス
```

PORT 環境変数でポートを変更できます:

```bash
PORT=3000 make local
```

`make local` はインメモリの回答ログストアを使用するため、D1 は不要です。

## GitHub Pages で公開 UI を配信する

公開クイズ画面だけを GitHub Pages に置き、API と admin は Cloudflare Pages 側に残す split 構成をサポートしています。

### 1. 公開 UI をビルド

```bash
cd quiz-app
make build-pages
```

成果物は `gh-pages-dist/` に出力されます。

### 2. 公開 UI の API 接続先を設定

`public/quiz-config.js` はデフォルトで same-origin を使います。GitHub Pages デプロイ時は、workflow が `gh-pages-dist/quiz-config.js` を上書きし、公開 UI から参照する API 配信元を設定します。

リポジトリの **Settings > Secrets and variables > Actions > Variables** に、以下の variable を追加してください。

| Variable 名 | 説明 | 例 |
|---|---|---|
| `QUIZ_API_BASE_URL` | 公開 UI から呼び出す API 配信元 | `https://quiz.gocon.jp` |

### 3. GitHub Pages workflow

- workflow: `.github/workflows/quiz-app-github-pages.yml`
- 役割: `quiz-app/public/index.html` を GitHub Pages に配信
- 前提: `QUIZ_API_BASE_URL` が設定されていること

公開クイズ UI から API を cross-origin で呼べるように、public quiz API は CORS を有効化しています。

## ビルド (Cloudflare Pages 用 WASM)

以下のツールが必要です。

| ツール | バージョン | インストール |
|---|---|---|
| Go | 1.25.x | [https://go.dev/dl/](https://go.dev/dl/) |
| TinyGo | 0.40.1 | [https://tinygo.org/getting-started/install/](https://tinygo.org/getting-started/install/) |

> TinyGo 0.40.1 がサポートする Go は 1.19〜1.25 です。システムの Go が 1.26 以上の場合は `GO` 変数で 1.25 系を指定してください。

```bash
make build GO=/usr/local/go/bin/go
```

成果物は `dist/` に出力されます。

```
dist/
├── index.html
├── admin/index.html
└── functions/api/
    ├── quiz.wasm
    └── admin/stats.wasm
```

## Wrangler でのローカル動作確認

```bash
# D1 スキーマの初期化
npx wrangler d1 execute quiz-db --local --file=schema.sql --yes

# 静的ファイルをビルドしてから起動
make build GO=... && npx wrangler pages dev dist
```

## テスト

```bash
cd quiz-app
go test ./...
```

## 問題の追加方法

### 1. コードファイルを配置

`functions/api/code/` に Go ファイルを追加します。  
ファイル名は `{author}_{qN}_question.go` / `{author}_{qN}_answer.go` の形式を推奨します。

```go
//go:build ignore

package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
```

> `//go:build ignore` の行は API レスポンス時に自動で除去されます。

### 2. `quizes.yaml` に問題を追加

```yaml
- id: "author_q1"
  title: "問題のタイトル"
  text: "問題文をここに書く"
  question_code_ref: "code/author_q1_question.go"   # 省略可
  choices:
    - "選択肢 A"
    - "選択肢 B"
    - "選択肢 C"
    - "選択肢 D"
  answer: 2                                           # 0始まりのインデックス
  explanation: "解説文。URL は自動でリンクになります。"
  answer_code_ref: "code/author_q1_answer.go"        # 省略可
  answer_code_play_ref: "https://go.dev/play/p/..."  # 省略可
```

## API リファレンス

### クイズ API

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/quiz/session` | ユニーク 5 問のセッションを取得 |
| GET | `/api/quiz` | ランダム 1 問を取得 |
| POST | `/api/quiz/answer` | 回答を送信し正誤・解説を受け取る |

**GET /api/quiz/session**

クエリパラメータ `exclude` に除外する問題 ID をカンマ区切りで指定できます。  
(チャレンジモードで既出問題をスキップするために使用)

```
GET /api/quiz/session?exclude=sivchari_q1,tomtwinkle_q3
```

**POST /api/quiz/answer**

```json
// リクエスト
{ "question_id": "sivchari_q1", "answer": 2 }

// レスポンス
{
  "correct": true,
  "explanation": "...",
  "answer_code": "...",
  "answer_code_play_ref": "https://go.dev/play/p/..."
}
```

### 管理 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/admin/api/stats` | 問題ごとの正答率一覧 |
| GET | `/admin/api/quizzes` | 全問題の完全データ (答え・解説含む) |

管理 API は Cloudflare Access によって保護されています。GitHub Pages に出すのは公開クイズ UI のみで、admin 画面は引き続き Cloudflare 側で配信する想定です。

## GitHub Secrets の設定

CI/CD と Terraform が動作するために、リポジトリに以下の secrets を設定してください。  
GitHub の **Settings > Secrets and variables > Actions** から追加します。

| Secret 名 | 説明 | 取得方法 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン | Cloudflare ダッシュボード > My Profile > API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID | Cloudflare ダッシュボード > 右サイドバー |
| `CF_ZONE_ID` | gocon.jp ゾーン ID | Cloudflare ダッシュボード > gocon.jp > Overview |

> `CLOUDFLARE_API_TOKEN` には **Cloudflare Pages, D1, DNS** への編集権限が必要です。  
> `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が未設定の場合、Terraform CI は自動的にスキップされます。

## インフラのセットアップ (初回のみ)

### 1. terraform.tfvars を編集

```bash
cd quiz-app/terraform
```

`terraform.tfvars` に実際の値を設定します。

```hcl
cloudflare_api_token  = "your-api-token"
cloudflare_account_id = "your-account-id"
cloudflare_zone_id    = "your-zone-id"

allowed_emails = [
  "admin@example.com",  # 管理画面・ステージングにアクセスできるメールアドレス
]
```

### 2. Terraform を実行

```bash
terraform init
terraform plan
terraform apply
```

`terraform apply` が成功すると、以下のリソースが作成されます。

| Cloudflare リソース | 内容 |
|---|---|
| Pages Project | `quiz-app` (本番: `quiz.gocon.jp`) |
| D1 Database | `quiz-db` |
| DNS Record | `quiz.gocon.jp` / `staging.quiz.gocon.jp` |
| Access Application | 管理画面 (`/admin`) とステージング環境を保護 |

### 3. wrangler.toml に D1 の database_id を設定

Terraform 出力の D1 database ID を `wrangler.toml` に記入します。

```bash
terraform output  # database_id を確認
```

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "quiz-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← ここに設定
```

## ステージングへのデプロイ

`main` 以外のブランチをプッシュすると、Cloudflare Pages が自動でプレビュー環境を作成します。

```bash
git push origin feature/your-branch
```

プレビュー URL は `https://<hash>.quiz-app.pages.dev` の形式で発行されます。  
ステージング用カスタムドメイン (`staging.quiz.gocon.jp`) は Cloudflare Access で保護されており、`allowed_emails` に登録済みのアカウントのみアクセス可能です。

### ステージングの D1 スキーマを初期化する場合

```bash
npx wrangler d1 execute quiz-db \
  --file=quiz-app/schema.sql \
  --remote \
  --env staging
```

## 本番環境へのデプロイ

`main` ブランチへのプッシュ (PR マージ) が自動デプロイのトリガーです。

```
main へのマージ
  └─ quiz-app / Deploy (GitHub Actions)
       ├─ TinyGo で WASM ビルド
       ├─ D1 スキーマのマイグレーション (--remote)
       └─ Cloudflare Pages へデプロイ
```

> `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が GitHub Secrets に設定されていない場合、デプロイワークフローは失敗します。

デプロイ完了後は `https://quiz.gocon.jp` で本番サイトを確認できます。

## アクセス許可の追加

管理画面 (`/admin`) およびステージング環境へのアクセスは Cloudflare Access で制御されます。  
許可するメールアドレスを追加するには、`terraform.tfvars` を編集して `terraform apply` を実行します。

```hcl
# terraform/terraform.tfvars
allowed_emails = [
  "admin@example.com",
  "newmember@example.com",  # 追加
]
```

```bash
cd quiz-app/terraform
terraform apply
```

または GitHub Actions の Terraform CI が `main` マージ時に自動 apply します (`quiz-app/terraform/**` 変更時)。

## インフラ (Terraform)

Terraform の CI は以下のように動作します。

| イベント | 動作 |
|---|---|
| PR 作成・更新 | `terraform plan` を実行し結果を PR にコメント |
| `main` マージ | `terraform apply` を実行し state をコミット |
| Secrets 未設定 | CI をスキップ (notice を表示) |

## 注意事項

- TinyGo 0.40.1 は Go 1.19〜1.25 をサポートしています。Go 1.26 以上のシステムでは `make build GO=<go1.25パス>` を使用してください。
- `quiz-app/` は独立した Go モジュールです (`github.com/GoCon/2026-codelab/quiz-app`)。リポジトリルートの Go モジュールとは別管理です。
