# duolingo-mode

duolingo-mode を搭載した standalone の Go CodeLabアプリです。
Vue 3 + TypeScript + Tailwind CSS で構成し、状態管理はすべてフロントエンド内のMock データで完結します。

## UI

- 375px〜430px の縦画面に最適化した片手操作 UI
- duolingo形式の長文を読まずにサクサクプレイ出来る問題構成
- 出題形式を、単語を順番に選んでコードを完成させる穴埋め形式に統一
- Stage1の問題を全て回答した段階でスペシャルページへの導線を表示

## クイズデータ

本アプリケーションのクイズ問題は、`src/data/stages.toml` を編集することで、追加・変更・削除が可能です。

### データ構造

TOMLファイルは「キャンペーンティア（難易度レベル）」と、その中に紐づく「ステージ（各問題）」の二層構造になっています。

* `[[campaignTiers]]` : 難易度グループを定義します。
* `[[campaignTiers.stages]]` : 各ティアに属するクイズ問題を定義します。


### 各フィールドの解説

#### 1. ティア定義 (`[[campaignTiers]]`)
| フィールド名 | 型 | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | ティアの一意な識別子（他のティアと重複不可） |
| `title` | `string` | ✅ | 画面に表示されるタイトル（例: `"Stage 1"`） |
| `difficultyLabel` | `string` | ✅ | 難易度バッジのラベル（例: `"Tier 1"`） |
| `description` | `string` | ✅ | ティアの概要説明 |
| `unlocksSpecial` | `boolean` |  | `true` にすると、このティアを全問正解した際にスペシャルページへのリンクが解放されます |

#### 2. ステージ定義 (`[[campaignTiers.stages]]`)
| フィールド名 | 型 | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✅ | 問題の一意な識別子 |
| `kind` | `string` | ✅ | 出題形式 "fill"(穴埋め方式)のみサポート |
| `label` | `string` | ✅ | 出題クイズのラベル |
| `title` | `string` | ✅ | 問題のタイトル |
| `prompt` | `string` | ✅ | プレイヤーへの指示・お題のテキスト |
| `outputLines` | `string` | ✅ | **ヒアドキュメント（`"""`）** で記述。期待されるコンソール出力結果（空の場合は空のまま） |
| `templateLines` | `string` | ✅ | **ヒアドキュメント（`"""`）** で記述。出題するコード。空欄にしたい部分に `[1]`, `[2]` と記述します |
| `pool` | `string[]` | ✅ | 選択肢プール（ボタンとして並ぶ単語のリスト） |
| `correctAnswers` | `string[]` | ✅ | 正解の配列。`[1]`, `[2]` の順番に一致する文字列を並べます |
| `why` | `string` | ✅ | 解説テキスト。`` `code` `` のようにバッククォートで囲むとインラインコード装飾になります |
| `takeaway` | `string` | ✅ | 今回のポイント（まとめ）テキスト |
| `playgroundUrl` | `string` |  | 解説画面から遷移できる Go Playground の絶対URL（`https://go.dev/play/...` のみ許可） |

- `templateLines` 内のプレースホルダーは、必ず `[1]`, `[2]`, `[3]`... と **1から始まる連番かつ登場順** に並べてください。飛び番や順序の狂いがある場合、パースエラーになります。
- `correctAnswers` に指定した文字列は、プレイヤーが選ぶ `pool`（選択肢）の中に過不足なく存在している必要があります。

## 開発コマンド

```bash
cd quiz-app2
make local
```

デフォルトでは `http://localhost:8788/` で起動します。

ローカル preview:

```bash
cd quiz-app2
npm run build
npm run preview -- --host
```

ビルド確認:

```bash
cd quiz-app2
npm run build
```

build path チェック:

```bash
cd quiz-app2
npm run test:build
```

ローカルのフルテスト:

```bash
cd quiz-app2
make test
```

UI 動作テスト:

```bash
cd quiz-app2
npm run test
```

## GitHub Pages デプロイ

- `.github/workflows/quiz-app2-build.yml` が branch push / pull request / manual dispatch で `make test` を実行します
- `.github/workflows/quiz-app2-pages.yml` が `quiz-app2/dist` を GitHub Pages に配備します
- Pages 向け build は `VITE_BASE_PATH` を明示して repository path 付きで生成します
- ローカルの `npm run dev` / `npm run build` は `/` base のまま動きます

## 補足

- バックエンドや telemetry 連携はまだ入れていません
- special page URL は現在 placeholder です
- 画面操作の自動テストは Vitest + Vue Test Utils + jsdom を使っています
