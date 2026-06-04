/**
 * 1行日記の入力コンポーネント
 *
 * 「その日のひとこと」を入力する。保存ボタンはなく、フォーカスを外した
 * タイミング（onBlur）で自動保存する。画面を閉じる際の取りこぼしを防ぐため、
 * アンマウント時にも未保存分をフラッシュする。
 *
 * locked=true（Premium ロック）のときは入力欄の代わりにペイウォール誘導を表示。
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Lock } from 'lucide-react-native';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { DAILY_NOTE_MAX_LENGTH } from '@/lib/db/queries/dailyNotes';

type DailyNoteInputProps = {
  /** 保存済みのメモ */
  value: string;
  /** 保存ハンドラ（onBlur / アンマウント時に呼ばれる） */
  onSave: (note: string) => void;
  /** Premium ロック（過去7日以上前のメモ閲覧） */
  locked?: boolean;
  /** ロック時のタップ（ペイウォール表示） */
  onLockedPress?: () => void;
  /** 編集可否（未来日など記録不可のとき false） */
  editable?: boolean;
  /** モーダル用の小さめレイアウト */
  compact?: boolean;
  /** プレースホルダ */
  placeholder?: string;
  style?: ViewStyle;
};

export function DailyNoteInput({
  value,
  onSave,
  locked = false,
  onLockedPress,
  editable = true,
  compact = false,
  placeholder = '今日の気分や体調をひとこと（任意）',
  style,
}: DailyNoteInputProps) {
  const [draft, setDraft] = useState(value);

  // 外部の value 変更（日付切り替え等）に追従
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // onBlur / アンマウント時に最新値を参照できるよう ref に保持
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = () => {
    const next = draftRef.current.trim();
    if (next !== valueRef.current.trim()) {
      onSaveRef.current(next);
    }
  };

  // アンマウント時に未保存分を保存（モーダルを閉じた等）
  useEffect(() => {
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBlur = () => {
    flush();
    Haptics.selectionAsync().catch(() => {});
  };

  // Premium ロック表示
  if (locked) {
    return (
      <Pressable
        onPress={onLockedPress}
        style={({ pressed }) => [
          styles.lockedContainer,
          compact && styles.lockedCompact,
          pressed && styles.pressed,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Premiumで過去のメモを振り返る"
      >
        <Lock size={16} color={palette.muted} />
        <Text style={styles.lockedText}>
          7日以上前のメモは Premium で振り返れます
        </Text>
      </Pressable>
    );
  }

  const remaining = DAILY_NOTE_MAX_LENGTH - draft.length;

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={handleBlur}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={palette.gray400}
        multiline
        maxLength={DAILY_NOTE_MAX_LENGTH}
        style={[
          styles.input,
          compact && styles.inputCompact,
          !editable && styles.inputDisabled,
        ]}
        accessibilityLabel="今日のひとこと入力欄"
        accessibilityHint="気分や体調を1行で記録できます。サーバーには送信されません"
      />
      {editable && draft.length > 0 && (
        <Text
          style={[
            styles.counter,
            remaining <= 10 && styles.counterWarning,
          ]}
        >
          残り{remaining}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
  },
  containerCompact: {
    padding: spacing.sm,
  },
  input: {
    fontSize: typography.scale.body,
    color: palette.ink,
    minHeight: 48,
    lineHeight: typography.scale.body * typography.lineHeight.normal,
    textAlignVertical: 'top',
  },
  inputCompact: {
    fontSize: typography.scale.sm,
    minHeight: 36,
  },
  inputDisabled: {
    color: palette.muted,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    fontSize: typography.scale.xs,
    color: palette.gray400,
  },
  counterWarning: {
    color: palette.warning,
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.gray50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  lockedCompact: {
    paddingVertical: spacing.sm,
  },
  lockedText: {
    flex: 1,
    fontSize: typography.scale.sm,
    color: palette.muted,
  },
  pressed: {
    opacity: 0.7,
  },
});
