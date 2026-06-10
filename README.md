# 2026-codelab

GoCon 2026 CodeLab用のクイズリポジトリです。

```
├── draft/                  # プロトタイプ
│   └── quizzes/            # CodeLabメンバーが作成したクイズ一覧
└── quiz-app/               # メインのクイズアプリ
    ├── src/
    │   ├── assets/         # ロゴや画像アセット
    │   ├── components/
    │   │   ├── games/      # クイズ形式（FillBlankTapGame, ChoiceSelectGame）
    │   │   └── ui/         # 共通UI（StageOutputPanel, PressButton）
    │   └── data/           # クイズのデータ（stages.toml, stages.ts）
    └── test/               # 堅牢なUI統合テスト（Vitest）
```

CodeLabの実行の仕方、開発方法はCodeLabのREADMEを参照してください。

[README](quiz-app/README.md)
