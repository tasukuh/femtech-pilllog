/**
 * Apple HealthKit 連携ダッシュボード（Premium 機能）
 *
 * - 未購入: ロックアップ表示
 * - iOS 以外: 非表示
 * - 権限未取得: 権限要求プロンプト
 * - 正常: 12 週相関チャート
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Lock, Heart, Moon } from 'lucide-react-native';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePremium } from '@/lib/premium';
import {
  requestHealthPermissions,
  isHealthKitAvailable,
  HEALTH_CONNECTED_KEY,
} from '@/lib/health/permissions';
import { fetchCorrelationData } from '@/lib/health/queries';
import { getSetting, setSetting } from '@/lib/db/queries/appSettings';
import { CorrelationChart } from './CorrelationChart';

type Props = {
  sheetId: string;
};

export function HealthDashboard({ sheetId }: Props) {
  const router = useRouter();
  const { isPremium } = usePremium();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // iOS 以外は表示しない
  if (Platform.OS !== 'ios') return null;

  // 接続状態の初期チェック
  // isHealthKitAvailable() は「端末能力」であって「権限」ではないため、
  // hasPermission には使わない。過去に接続済みなら HealthKit を再初期化
  // （許可済みならダイアログは出ない）してデータ表示へ、未接続なら接続ボタンを出す。
  useEffect(() => {
    if (!isPremium) return;
    let cancelled = false;
    (async () => {
      const available = await isHealthKitAvailable();
      if (!available) {
        if (!cancelled) setHasPermission(false);
        return;
      }
      const connected = await getSetting(HEALTH_CONNECTED_KEY);
      if (connected === 'true') {
        // 既に接続済み: 再初期化（未許可項目だけダイアログ、許可済みは無音）してから読み込む
        const granted = await requestHealthPermissions();
        if (!cancelled) setHasPermission(granted);
      } else {
        if (!cancelled) setHasPermission(false); // 「ヘルスケアを接続する」ボタンを表示
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPremium]);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const granted = await requestHealthPermissions();
    if (granted) {
      await setSetting(HEALTH_CONNECTED_KEY, 'true');
    }
    setHasPermission(granted);
    setIsRequestingPermission(false);
  };

  const { data: correlationData, isLoading } = useQuery({
    queryKey: ['healthCorrelations', sheetId],
    queryFn: () => fetchCorrelationData(sheetId),
    staleTime: 60 * 60 * 1000,
    enabled: isPremium && hasPermission === true,
  });

  // 未購入状態
  if (!isPremium) {
    return (
      <Card style={styles.lockedCard}>
        <View style={styles.lockedHeader}>
          <View style={styles.lockIconWrap}>
            <Lock size={20} color={palette.primary} />
          </View>
          <Text style={styles.lockedTitle}>Appleヘルスケアと連携</Text>
          <Text style={styles.lockedBadge}>Premium</Text>
        </View>
        <Text style={styles.lockedDescription}>
          睡眠時間・安静時心拍数とピルの服薬記録を照らし合わせて、12週間の変化を可視化します
        </Text>
        <View style={styles.featureList}>
          <FeatureRow icon={<Moon size={14} color={palette.success} />} label="睡眠との相関" />
          <FeatureRow icon={<Heart size={14} color={palette.warning} />} label="安静時心拍との相関" />
        </View>
        <Button
          onPress={() => router.push('/modal/paywall')}
          variant="secondary"
          fullWidth
        >
          Premiumを見る
        </Button>
      </Card>
    );
  }

  // 権限チェック中
  if (hasPermission === null) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={palette.primary} />
      </Card>
    );
  }

  // 権限未取得
  if (!hasPermission) {
    return (
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Appleヘルスケアと連携</Text>
        <Text style={styles.permissionDescription}>
          睡眠・心拍データを読み込むには、ヘルスケアへのアクセスを許可してください
        </Text>
        <Button
          onPress={handleRequestPermission}
          loading={isRequestingPermission}
          fullWidth
        >
          ヘルスケアを接続する
        </Button>
      </Card>
    );
  }

  // データ読み込み中
  if (isLoading || !correlationData) {
    return (
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Appleヘルスケアと連携</Text>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>データを読み込み中...</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionTitle}>ヘルスケア相関グラフ</Text>
      <Text style={styles.subtitle}>過去12週間の服薬率・睡眠・心拍の推移</Text>
      <CorrelationChart data={correlationData} />
      <Text style={styles.disclaimer}>
        このグラフは参考情報です。医療アドバイスではありません。
      </Text>
    </Card>
  );
}

function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.featureRow}>
      {icon}
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  lockedCard: {
    gap: spacing.md,
    backgroundColor: palette.primaryBg,
    borderColor: palette.primarySoft,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: palette.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
    flex: 1,
  },
  lockedBadge: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.semibold,
    color: palette.primary,
    backgroundColor: palette.cardBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  lockedDescription: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  featureList: {
    gap: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureLabel: {
    fontSize: typography.scale.sm,
    color: palette.ink,
  },
  sectionTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  subtitle: {
    fontSize: typography.scale.xs,
    color: palette.muted,
    marginTop: -spacing.xs,
  },
  permissionDescription: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: typography.scale.sm,
    color: palette.muted,
  },
  disclaimer: {
    fontSize: typography.scale.xs,
    color: palette.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
