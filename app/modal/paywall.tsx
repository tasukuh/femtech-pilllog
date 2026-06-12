/**
 * Premium ペイウォールモーダル
 *
 * - RevenueCat から価格を動的取得
 * - 買い切り（Non-Consumable または Non-Renewing Subscription）
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, History, Heart, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { Button } from '@/components/ui/Button';

type PackageInfo = {
  identifier: string;
  priceString: string;
  localizedDescription: string;
};

export default function PaywallModal() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const Purchases = (await import('react-native-purchases')).default;
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (pkg) {
        setPackageInfo({
          identifier: pkg.identifier,
          priceString: pkg.product.priceString,
          localizedDescription: pkg.product.description,
        });
      }
    } catch (err) {
      console.warn('[Paywall] Could not load offerings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const Purchases = (await import('react-native-purchases')).default;
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (!pkg) throw new Error('No package available');

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const entitlement = customerInfo.entitlements.active['premium'];
      if (entitlement) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch (err: any) {
      if (err?.userCancelled) return;
      console.error('[Paywall] Purchase failed:', err);
      Alert.alert('購入に失敗しました', '時間をおいて再試行してください');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const Purchases = (await import('react-native-purchases')).default;
      const customerInfo = await Purchases.restorePurchases();
      const entitlement = customerInfo.entitlements.active['premium'];
      if (entitlement) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('復元しました', 'Premiumが有効になりました', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('購入履歴なし', 'このアカウントに購入履歴が見つかりませんでした');
      }
    } catch (err) {
      console.error('[Paywall] Restore failed:', err);
      Alert.alert('復元に失敗しました', '時間をおいて再試行してください');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          accessibilityLabel="閉じる"
          accessibilityRole="button"
        >
          <X size={24} color={palette.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* タイトル */}
        <View style={styles.titleSection}>
          <View style={styles.iconBadge}>
            <Heart size={32} color={palette.primary} />
          </View>
          <Text style={styles.title}>ピルログ Premium</Text>
          <Text style={styles.subtitle}>買い切り・解約不要</Text>
        </View>

        {/* 機能リスト */}
        <View style={styles.featuresSection}>
          <FeatureItem
            icon={<History size={20} color={palette.primary} />}
            title="すべての履歴を閲覧"
            description="7日以上前の服薬記録・日記をいつでも振り返れます"
          />
          <FeatureItem
            icon={<Moon size={20} color={palette.success} />}
            title="睡眠との相関グラフ"
            description="Appleヘルスケアの睡眠データと服薬遵守率を重ね合わせて表示"
          />
          <FeatureItem
            icon={<Heart size={20} color={palette.warning} />}
            title="安静時心拍との相関"
            description="ピルを続けることで体がどう変化するか、12週間の推移で確認"
          />
        </View>

        {/* 購入ボタン */}
        <View style={styles.purchaseSection}>
          {isLoading ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <>
              <Button
                onPress={handlePurchase}
                loading={isPurchasing}
                disabled={isPurchasing || isRestoring}
                fullWidth
              >
                {packageInfo
                  ? `${packageInfo.priceString} で購入`
                  : '購入する'}
              </Button>

              <Pressable
                onPress={handleRestore}
                disabled={isPurchasing || isRestoring}
                style={styles.restoreButton}
                accessibilityRole="button"
                accessibilityLabel="購入を復元する"
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color={palette.muted} />
                ) : (
                  <Text style={styles.restoreText}>購入を復元する</Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.legalNote}>
          一度購入すると永続的に利用できます。追加料金は発生しません。
        </Text>
      </ScrollView>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconWrap}>{icon}</View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
    alignItems: 'flex-end',
  },
  closeButton: {
    padding: spacing.sm,
  },
  content: {
    padding: spacing.xl,
    gap: spacing['2xl'],
  },
  titleSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: palette.ink,
  },
  subtitle: {
    fontSize: typography.scale.sm,
    color: palette.muted,
  },
  featuresSection: {
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: palette.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    gap: spacing.xs,
  },
  featureTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  featureDescription: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  purchaseSection: {
    gap: spacing.md,
    alignItems: 'center',
  },
  restoreButton: {
    paddingVertical: spacing.sm,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreText: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    textDecorationLine: 'underline',
  },
  legalNote: {
    fontSize: typography.scale.xs,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: typography.scale.xs * typography.lineHeight.normal,
  },
});
