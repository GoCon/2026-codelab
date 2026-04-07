# 2026-codelab

GoCon 2026 コードラボ用のクイズリポジトリです。
各自が Go に関する 4 択クイズを作成し、ブラウザでプレビューできます。

## 必要なもの

- Go 1.26 以上 (go.mod の toolchain で固定しています)
- `git config user.name` に GitHub ユーザーネームが設定されていること

## はじめかた

### 1. リポジトリをクローン

```sh
git clone https://github.com/GoCon/2026-codelab.git
cd 2026-codelab
```

### 2. 自分のクイズディレクトリを作成

```sh
./scripts/setup.sh
```

`git config user.name` から自動でユーザーネームを取得し、`quizzes/<your-username>/` にテンプレートが生成されます。

### 3. クイズを編集

`quizzes/<your-username>/quiz.yaml` を編集してください。テンプレートにサンプル問題とコメントが入っているので参考にしてください。

### 4. プレビューで確認

```sh
go run ./cmd/preview quizzes/<your-username>/quiz.yaml
```

http://localhost:8080 をブラウザで開くとクイズをプレビューできます。
YAML やコードファイルを編集した後、ブラウザをリロードすると即反映されます。

### 5. PR を出す

クイズが完成したら、自分のユーザーネームのディレクトリのみを含む PR を作成してください。

## クイズの書き方

### ディレクトリ構成

```
quizzes/<your-username>/
  quiz.yaml          # クイズ定義
  code/
    q1.go            # コードファイル (quiz.yaml から参照)
    q2_question.go
    q2_answer.go
```

### 問題のパターン

#### テキストのみの問題

```yaml
questions:
  - text: "Go でスライスの長さを取得する組み込み関数は？"
    choices:
      - "size()"
      - "count()"
      - "len()"
      - "length()"
    answer: 2
    explanation: "len() は Go の組み込み関数です。"
    answer_code_ref: "code/q1.go"
```

#### コードを読ませる問題

```yaml
questions:
  - text: "このコードの出力は何？"
    question_code_ref: "code/q2_question.go"
    choices:
      - "5"
      - "hello"
      - "コンパイルエラー"
      - "0"
    answer: 0
    explanation: "len() は文字列のバイト数を返します。"
    answer_code_ref: "code/q2_answer.go"
```

### フィールド一覧

| フィールド | 必須 | 説明 |
|---|---|---|
| `text` | o | 問題文 |
| `question_code_ref` | | 問題文に表示するコードファイル (quiz.yaml からの相対パス) |
| `choices` | o | 選択肢 (4 つ) |
| `answer` | o | 正解の index (0-indexed: 0 が最初の選択肢) |
| `explanation` | o | 解説 (正解・不正解どちらでも表示されます) |
| `answer_code_ref` | | 正解時のみ表示するコードファイル (quiz.yaml からの相対パス) |
