# Domain Components

ピルログ固有のドメインコンポーネント集

## Components

### SheetProgressRing
円形のプログレスリングで現在のシート進捗を表示

**Props:**
- `currentDay: number` - 現在の日数
- `totalDays: number` - シート総日数
- `sheetNumber: number` - シート番号
- `daysUntilBreak: number` - 休薬期間までの日数

**Usage:**
```tsx
<SheetProgressRing
  currentDay={14}
  totalDays={28}
  sheetNumber={3}
  daysUntilBreak={7}
/>
```

### DoseCard
服薬カード - 薬の情報と服薬ボタンを表示

**Props:**
- `medication: PillMedication` - 薬情報
- `doseRecord: DoseRecord` - 服薬記録
- `onTap: () => void` - タップ時のコールバック

**Usage:**
```tsx
<DoseCard
  medication={medication}
  doseRecord={record}
  onTap={() => handleDoseTap()}
/>
```

### CalendarGrid
月次カレンダービュー - 服薬記録をカレンダー形式で表示

**Props:**
- `month: Date` - 表示する月
- `records: DoseRecord[]` - 服薬記録の配列
- `onDateTap?: (date: Date) => void` - 日付タップ時のコールバック

**Usage:**
```tsx
<CalendarGrid
  month={new Date()}
  records={doseRecords}
  onDateTap={(date) => console.log(date)}
/>
```

## Design Principles

- デザイントークンを厳格に使用
- アクセシビリティラベル必須
- Haptic フィードバック付き
- アニメーションは react-native-reanimated を使用
