# RevenueCat × App Store 課金セットアップガイド

> **対象**: Expo (React Native) アプリで買い切り（Non-Consumable）課金を実装する際の手順。
> **想定スタック**: Expo SDK 55+ / `react-native-purchases` v10+ / EAS Build
> **作成日**: 2026-06-13（ピルログ Day 11 の実装をベースに作成）

---

## 概要

以下の順番で設定する。コードより先にダッシュボード設定が必要。

```
App Store Connect（IAP 登録）
    ↓
RevenueCat（プロジェクト作成 → Product/Entitlement/Offering 設定）
    ↓
コード（SDK 初期化 → 購入フロー実装）
    ↓
.env.local に API キー設定 → EAS Build / OTA
```

---

## Step 1: App Store Connect — アプリ内購入の登録

1. https://appstoreconnect.apple.com/apps/{APP_ID}/features/iap を開く
2. 「+」→ **「消耗しない（Non-Consumable）」** を選択
3. 以下を入力して「作成」:

| 項目 | 推奨値 |
|------|--------|
| 種類 | Non-Consumable（消耗しない） |
| 参照名 | `{アプリ名} Premium`（管理用ラベル） |
| 製品ID | `{bundle_id}.premium`（例: `jp.tasuku.pilllog.premium`） |

4. 詳細画面で追加設定:
   - **価格スケジュール**: 「+」→ 価格を選択（例: ¥600 = Tier 6）
   - **ローカライズ（日本語）**:
     - 表示名: `{アプリ名} Premium`
     - 説明: 機能の説明（100文字以内）
   - **審査に関する情報**: スクリーンショット（1290×2796px 推奨）をアップロード
   - **配信可否**: 全地域で OK（デフォルト）
5. 「保存」

> **注意**: 審査スクリーンショットのサイズが合わない場合:
> ```bash
> sips -z 2556 1179 ~/Downloads/元画像.png --out ~/Downloads/review.png
> ```

---

## Step 2: RevenueCat — プロジェクト設定

### 2-1. プロジェクト作成

1. https://app.revenuecat.com → 「+ Create new project」
2. Project name: アプリ slug（例: `pilllog`）
3. Category: Lifestyle / Health & Fitness など
4. Platform(s): Native Apple

### 2-2. iOS App を追加

1. 左メニュー「Apps」→「New app configuration」→ App Store を選択
2. App name: アプリ名（管理用）
3. App Bundle ID: `{bundle_id}`（例: `jp.tasuku.pilllog`）
4. **In-app purchase key configuration（P8 キー）**:
   - App Store Connect → https://appstoreconnect.apple.com/access/integrations/api → チームキー
   - 「+」→ 名前: `RevenueCat`、アクセス: `App Manager` → 作成 → **ダウンロード**（一度しかできない）
   - ダウンロードした `.p8` ファイルのファイル名を `SubscriptionKey_{KeyID}.p8` に変更してアップロード
   - Key ID と Issuer ID を入力
5. 「Save」

> **ファイル名変換コマンド**:
> ```bash
> cp ~/Downloads/AuthKey_XXXXXXXXXX.p8 ~/Downloads/SubscriptionKey_XXXXXXXXXX.p8
> ```

### 2-3. Entitlement を設定

1. 左メニュー「Product catalog」→「Entitlements」
2. 作成時に自動生成された `premium`（または任意名）があることを確認
3. なければ「+」→ Identifier: **`premium`**（コードの `ENTITLEMENT_ID` と一致させる）

### 2-4. Product を追加

1. 「Product catalog」→「Products」→「+ New」
2. App を選択: `{アプリ名} (App Store)`
3. Identifier: `{bundle_id}.premium`（Step 1 の製品ID と同じ）
4. Display name: `{アプリ名} Premium`
5. Product type: **Non-consumable**
6. 「Save」

### 2-5. Entitlement に Product を Attach

1. 「Entitlements」→ `premium` をクリック
2. 「Add product」→ `{アプリ名} (App Store)` を選択
3. 作成した Product を選択して「Attach」

### 2-6. Offering を設定

1. 「Offerings」→ `default` をクリック
2. 右上「Edit」→ Lifetime パッケージを探す
3. `{アプリ名} (App Store)` の行で「No product」ドロップダウンから Product を選択
4. 「Save」

> **ポイント**: `offerings.current?.availablePackages[0]` で最初のパッケージを取得する実装の場合、
> Lifetime パッケージが先頭に来るよう Offering 内の順序を確認する。

### 2-7. API キーをコピー

1. 左メニュー「API keys」→「SDK API keys」
2. `{アプリ名} (App Store)` の「Show」をクリック
3. `appl_` で始まるキーをコピー

---

## Step 3: コード実装

### 3-1. パッケージインストール

```bash
npx expo install react-native-purchases
```

### 3-2. app.json の設定

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.healthkit": true  // HealthKit を使う場合のみ
      }
    }
  }
}
```

RevenueCat 自体はネイティブ entitlement 不要。

### 3-3. SDK 初期化（`app/_layout.tsx`）

```ts
// 起動時に一度だけ呼ぶ
if (Platform.OS === 'ios') {
  const { default: Purchases } = await import('react-native-purchases');
  const rcKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (rcKey) {
    Purchases.configure({ apiKey: rcKey });
  }
}
```

### 3-4. Premium 判定フック（`lib/premium.ts`）

```ts
const ENTITLEMENT_ID = 'premium'; // RevenueCat の Entitlement Identifier と一致

export function usePremium(): { isPremium: boolean; isLoading: boolean } {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'ios') { setIsLoading(false); return; }
    const init = async () => {
      try {
        const Purchases = (await import('react-native-purchases')).default;
        const info = await Purchases.getCustomerInfo();
        setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
        Purchases.addCustomerInfoUpdateListener((info) => {
          setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
        });
      } catch { /* noop */ } finally { setIsLoading(false); }
    };
    init();
  }, []);

  return { isPremium, isLoading };
}
```

### 3-5. 購入フロー（ペイウォールモーダル）

```ts
const handlePurchase = async () => {
  const Purchases = (await import('react-native-purchases')).default;
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages[0];
  if (!pkg) throw new Error('No package');

  const { customerInfo } = await Purchases.purchasePackage(pkg);
  if (customerInfo.entitlements.active['premium']) {
    // 購入成功 → Premium 解放
  }
};

const handleRestore = async () => {
  const Purchases = (await import('react-native-purchases')).default;
  const info = await Purchases.restorePurchases();
  if (info.entitlements.active['premium']) {
    // 復元成功
  }
};
```

---

## Step 4: 環境変数の設定

### ローカル開発用（`.env.local`）

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxx
```

> `.env.local` は `.gitignore` に追加済みであることを確認。

### EAS Build 用（本番ビルドに埋め込む場合）

```bash
eas secret:create --scope project \
  --name EXPO_PUBLIC_REVENUECAT_IOS_KEY \
  --value appl_xxxxxxxxxxxxxxxxxxxx
```

---

## Step 5: テスト

### Sandbox テスターの作成

1. https://appstoreconnect.apple.com/access/testers → 「+」でアカウント作成
2. 実機の「設定」→「App Store」→ 下部「Sandbox アカウント」でサインイン
3. アプリを起動して購入フローを実行（実際の課金は発生しない）

### テストチェックリスト

| # | 確認内容 | 期待結果 |
|---|---------|---------|
| T1 | ペイウォールモーダルの価格表示 | `〇〇円 で購入` が出る |
| T2 | Sandbox で購入 | 購入完了・Premium 解放 |
| T3 | 購入後にアプリ再起動 | `isPremium` が true を保持 |
| T4 | 「購入を復元する」 | 既購入なら Premium 復元 |
| T5 | 未購入端末で「購入を復元する」 | 「購入履歴なし」アラート |

---

## よくあるエラー

### ペイウォールの価格が出ない（空白）

1. RevenueCat ダッシュボードで Offering の `default` が Current に設定されているか
2. Lifetime パッケージに App Store の Product が紐づいているか
3. App Store Connect の IAP が保存されているか（下書き状態でも Sandbox は動く）
4. `EXPO_PUBLIC_REVENUECAT_IOS_KEY` が正しく設定されているか

### `purchasePackage` が失敗する

- Sandbox テスターとしてサインインしているか
- 実機で動かしているか（Simulator は StoreKit 制限あり）

### ビルドで `react-native-purchases` が見つからない

```bash
npx expo install react-native-purchases
eas build --platform ios --profile production
```
OTA では反映されない（ネイティブモジュールのため）。

---

## 参考リンク

- RevenueCat ドキュメント: https://www.revenuecat.com/docs/getting-started
- App Store Connect IAP: https://developer.apple.com/in-app-purchase/
- `react-native-purchases` GitHub: https://github.com/RevenueCat/react-native-purchases

---

**作成**: 2026-06-13
**ベース**: ピルログ（`jp.tasuku.pilllog`）Day 11 実装
**次アプリでの流用**: Entitlement ID `premium` / Product ID `{bundle_id}.premium` のパターンを踏襲
