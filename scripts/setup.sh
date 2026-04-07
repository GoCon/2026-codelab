#!/bin/bash
set -euo pipefail

USERNAME=$(git config user.name 2>/dev/null || true)
if [ -z "$USERNAME" ]; then
  echo "git config user.name が設定されていません。先に設定してください:"
  echo "  git config --global user.name \"your-github-username\""
  exit 1
fi

QUIZ_DIR="quizzes/${USERNAME}"

if [ -d "$QUIZ_DIR" ]; then
  echo "${QUIZ_DIR} は既に存在します"
  exit 1
fi

cp -r quizzes/_template "$QUIZ_DIR"
sed -i '' "s/your-github-username/${USERNAME}/g" "$QUIZ_DIR/quiz.yaml"

echo "${QUIZ_DIR} を作成しました"
echo "プレビュー: go run ./cmd/preview ${QUIZ_DIR}/quiz.yaml"
