# quiz-app2

`quiz-app2` duolingo-mode を搭載した standalone の Go CodeLabアプリです。
Vue 3 + TypeScript + Tailwind CSS で構成し、状態管理はすべてフロントエンド内のMock データで完結します。

## UI

- 375px〜430px の縦画面に最適化した片手操作 UI
- duolingo形式の長文を読まずにサクサクプレイ出来る問題構成
- 出題形式を、単語を順番に選んでコードを完成させる穴埋め形式に統一
- Stage1の問題を全て回答した段階でスペシャルページへの導線を表示

## 出題

- 問題データの追加・差し替えは `src/data/stages.toml` を編集すると反映できます
- `playgroundUrl` に `https://go.dev/play/` の URL を設定すると、結果画面から正解コードを Go Playground で開いて実行できます
- `playgroundUrl` を更新するときは、share 前に必ず `gofmt` をかけたコードを使ってください
- `why` / `takeaway` のバッククォート `` `...` `` は、結果画面で inline code としてハイライト表示されます
- `templateLines` は、25 文字を大きく超える行を gofmt 風の複数行に分けておくと、コード表示エリアで読みやすくなります

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
