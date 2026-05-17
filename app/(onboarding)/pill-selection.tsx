/**
 * オンボーディング - ピル選択画面
 *
 * 一般的なピルのリストから選択 or カスタム入力
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OnboardingContainer } from '@/components/ui/OnboardingContainer';
import { Button } from '@/components/ui/Button';
import { palette, typography, spacing, radius } from '@/design-tokens';

const COMMON_PILLS = [
  { id: 'triquilar28', name: 'トリキュラー28', type: 'triphasic' as const },
  { id: 'triquilar21', name: 'トリキュラー21', type: 'triphasic' as const },
  { id: 'yaz_flex', name: 'ヤーズフレックス', type: 'extended' as const },
  { id: 'yaz', name: 'ヤーズ', type: 'monophasic' as const },
  { id: 'marvelon28', name: 'マーベロン28', type: 'monophasic' as const },
  { id: 'ange28', name: 'アンジュ28', type: 'triphasic' as const },
];

type PillSelectionData = {
  pillId: string;
  pillName: string;
  pillType: 'monophasic' | 'triphasic' | 'continuous' | 'extended';
};

export default function PillSelectionScreen() {
  const router = useRouter();
  const [selectedPillId, setSelectedPillId] = useState<string | null>(null);
  const [customPillName, setCustomPillName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handlePillSelect = (pillId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPillId(pillId);
    setShowCustomInput(pillId === 'custom');
    if (pillId !== 'custom') {
      setCustomPillName('');
    }
  };

  const handleNext = () => {
    if (!selectedPillId) return;

    let pillData: PillSelectionData;

    if (selectedPillId === 'custom') {
      if (!customPillName.trim()) return;
      pillData = {
        pillId: 'custom',
        pillName: customPillName.trim(),
        pillType: 'monophasic', // デフォルト
      };
    } else {
      const pill = COMMON_PILLS.find(p => p.id === selectedPillId);
      if (!pill) return;
      pillData = {
        pillId: pill.id,
        pillName: pill.name,
        pillType: pill.type,
      };
    }

    // データを次の画面に渡すため、router params に入れる
    router.push({
      pathname: '/(onboarding)/schedule-time',
      params: pillData,
    });
  };

  const canProceed = selectedPillId && (selectedPillId !== 'custom' || customPillName.trim());

  return (
    <OnboardingContainer step={2} totalSteps={5}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>服用中のピルを教えてください</Text>
        <Text style={styles.subtitle}>
          ピルの種類を選択することで、適切なシート管理ができます
        </Text>

        <View style={styles.pillList}>
          {COMMON_PILLS.map((pill) => (
            <Pressable
              key={pill.id}
              style={[
                styles.pillCard,
                selectedPillId === pill.id && styles.pillCardSelected,
              ]}
              onPress={() => handlePillSelect(pill.id)}
              accessibilityLabel={`${pill.name}を選択`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.pillName,
                  selectedPillId === pill.id && styles.pillNameSelected,
                ]}
              >
                {pill.name}
              </Text>
            </Pressable>
          ))}

          {/* その他 */}
          <Pressable
            style={[
              styles.pillCard,
              selectedPillId === 'custom' && styles.pillCardSelected,
            ]}
            onPress={() => handlePillSelect('custom')}
            accessibilityLabel="その他のピルを入力"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.pillName,
                selectedPillId === 'custom' && styles.pillNameSelected,
              ]}
            >
              その他
            </Text>
          </Pressable>

          {/* カスタム入力 */}
          {showCustomInput && (
            <TextInput
              style={styles.customInput}
              value={customPillName}
              onChangeText={setCustomPillName}
              placeholder="ピルの名前を入力してください"
              placeholderTextColor={palette.muted}
              autoFocus
              returnKeyType="done"
              accessibilityLabel="ピル名入力"
            />
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button onPress={handleNext} fullWidth disabled={!canProceed}>
            次へ
          </Button>
        </View>
      </ScrollView>
    </OnboardingContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  title: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.regular,
    color: palette.muted,
    marginBottom: spacing.xl,
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  pillList: {
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  pillCard: {
    backgroundColor: palette.cardBg,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  pillCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryBg,
  },
  pillName: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.medium,
    color: palette.ink,
  },
  pillNameSelected: {
    color: palette.primary,
    fontWeight: typography.weight.semibold,
  },
  customInput: {
    backgroundColor: palette.cardBg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.scale.body,
    fontWeight: typography.weight.regular,
    color: palette.ink,
  },
  buttonContainer: {
    marginTop: spacing.xl,
  },
});
