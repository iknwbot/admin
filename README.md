# 子ども食堂 管理コンソール

## 概要
市川市子ども食堂ネットワークの包括的管理システムのWeb管理画面です。GitHub Pagesでホスティングされ、Google Apps Script（GAS）APIと連携して動作します。

## ファイル構成
```
/admin-console/
├── index.html      # メインHTML
├── styles.css      # スタイルシート
├── config.js       # 設定ファイル
├── app.js          # アプリケーションロジック
└── README.md       # このファイル
```

## 機能
- **ダッシュボード**: 統計情報と最新の報告一覧
- **活動報告管理**: 報告ステータスの更新
- **ユーザー管理**: ユーザーの追加・削除
- **拠点管理**: 拠点の追加・削除
- **セキュリティ**: アクセスキーによるログイン認証

## セットアップ手順

### 1. GitHub Pages設定
1. GitHubリポジトリの`Settings` > `Pages`
2. `Source`を`Deploy from a branch`に設定
3. `Branch`を`main`の`/admin-console`フォルダに設定

### 2. 設定変更
`config.js`でAPI URLとアクセスキーを設定：
```javascript
const CONFIG = {
  API_URL: 'your-gas-api-url',
  ACCESS_KEY: 'your-access-key'
};
```

### 3. GAS設定
`check.gs`から管理画面関連のコードを削除し、APIエンドポイントのみ残す：
```javascript
function doGet(e) {
  const action = e.parameter.action;
  const path = e.parameter.path;
  
  // 管理画面API処理
  if (path && path.startsWith('admin/')) {
    // admin-console.gsの関数を呼び出し
  }
  
  // 既存のAPI処理...
}
```

## アクセスURL
```
https://your-username.github.io/your-repository/admin-console/
```

## セキュリティ
- アクセスキー認証
- セッションタイムアウト（1時間）
- HTTPS通信
- XSS対策（HTMLエスケープ）

## 開発・メンテナンス
- 設定変更は`config.js`で行う
- スタイル変更は`styles.css`で行う
- 機能追加は`app.js`で行う
- セキュリティアップデートを定期的に実施

## ブラウザ対応
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 注意事項
- アクセスキーは定期的に変更してください
- 本番環境では、より強固な認証システムの導入を検討してください
- APIエンドポイントのCORS設定が必要な場合があります