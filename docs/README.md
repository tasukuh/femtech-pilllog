# ピルログ - 法的ドキュメント & ランディングページ

このディレクトリには、App Store 申請に必要な法的ドキュメントとランディングページが含まれています。

## 📄 含まれるファイル

- `index.html` - ランディングページ
- `privacy-policy.html` - プライバシーポリシー
- `terms-of-service.html` - 利用規約

## 🌐 GitHub Pages で公開する手順

### 1. GitHubでリポジトリ設定を開く

https://github.com/tasukuh/femtech-pilllog/settings/pages

### 2. GitHub Pages を有効化

- **Source**: `Deploy from a branch`
- **Branch**: `main`
- **Folder**: `/docs`

### 3. 保存して数分待つ

公開URLは以下の形式になります：
```
https://tasukuh.github.io/femtech-pilllog/
```

### 4. URLの確認

以下のURLでアクセス可能になります：

- ホーム: https://tasukuh.github.io/femtech-pilllog/
- プライバシーポリシー: https://tasukuh.github.io/femtech-pilllog/privacy-policy.html
- 利用規約: https://tasukuh.github.io/femtech-pilllog/terms-of-service.html

## 📱 App Store Connect で使用するURL

App Store Connect の「App Privacy」セクションで、以下のURLを入力してください：

- **Privacy Policy URL**: `https://tasukuh.github.io/femtech-pilllog/privacy-policy.html`
- **Terms of Service URL**: `https://tasukuh.github.io/femtech-pilllog/terms-of-service.html`

## ✏️ 更新方法

ドキュメントを更新する場合：

1. HTMLファイルを編集
2. GitHubにpush
3. 数分後に自動的に反映

## 📝 注意事項

- 日付を更新する際は、HTMLファイルとMarkdownファイルの両方を更新してください
- 料金やサービス内容を変更する際は、利用規約も更新してください
- 重要な変更がある場合は、アプリ内でユーザーに通知してください
