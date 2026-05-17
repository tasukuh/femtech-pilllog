/**
 * ピルログ デザイントークン
 *
 * 99_shared_foundations.md の共通基盤に基づき、
 * ピルログ固有のアクセントカラーを適用
 */

// カラーパレット
export const palette = {
  // 共通ニュートラル
  cream: '#FAF7F2',         // ベース背景
  ink: '#1A1612',           // メインテキスト
  muted: '#8C7B6E',         // 補助テキスト
  border: 'rgba(26,22,18,0.08)',
  cardBg: '#FFFFFF',

  // ピルログ固有アクセント（ローズ・赤系）
  primary: '#C4645C',       // メインアクセント
  primarySoft: '#E8A5A0',   // 薄いアクセント
  primaryBg: '#FDF5F4',     // アクセント背景

  // ステータスカラー
  success: '#3D7A62',       // 服薬完了
  warning: '#E89B47',       // 注意
  error: '#D84747',         // エラー・飲み忘れ

  // グレースケール
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
} as const;

// タイポグラフィ
export const typography = {
  // フォントファミリー
  serif: 'ShipporiMincho-Bold',      // 見出し（和文明朝）
  sansJp: 'HiraginoSans-W3',         // 本文（iOS標準ゴシック）
  sansEn: 'DMSans-Regular',          // 英数字
  mono: 'SpaceMono-Regular',         // ラベル・数値

  // フォントサイズスケール
  scale: {
    h1: 28,
    h2: 22,
    h3: 18,
    body: 15,
    sm: 13,
    xs: 11,
    micro: 9,
  },

  // 行高さ
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },

  // フォントウェイト
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

// スペーシング
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

// 角丸
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,  // ボタン用
  full: 9999,
} as const;

// 影（最小限の使用を推奨）
export const shadow = {
  sm: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// アニメーション設定
export const animation = {
  // Reanimated用のスプリング設定
  spring: {
    damping: 18,
    stiffness: 200,
  },
  // デュレーション（ミリ秒）
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
} as const;

// ブレークポイント（タブレット対応時用）
export const breakpoints = {
  phone: 0,
  tablet: 768,
} as const;

// Z-index階層
export const zIndex = {
  base: 0,
  card: 10,
  overlay: 100,
  modal: 200,
  toast: 300,
  notification: 400,
} as const;

// エクスポートの型定義
export type Palette = typeof palette;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadow = typeof shadow;
export type Animation = typeof animation;
