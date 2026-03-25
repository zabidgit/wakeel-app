import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Image,
} from 'react-native';

const owlLogo = require('../../assets/owl-logo.png');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../theme';
import { getPairing, clearPairing, clearMessages } from '../storage';
import { PairingData, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

// ─── Settings Row ─────────────────────────────────────────────────────────────

interface SettingsRowProps {
  icon: string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
}

function SettingsRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  value,
  danger = false,
  onPress,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, danger && styles.rowDanger]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Icon circle */}
      <View
        style={[
          styles.rowIconCircle,
          { backgroundColor: iconBg || colors.surfaceContainerHigh },
        ]}
      >
        <Text style={[styles.rowIcon, { color: iconColor || colors.onSurfaceVariant }]}>
          {icon}
        </Text>
      </View>

      {/* Text group */}
      <View style={styles.rowTextGroup}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, danger && styles.rowSubtitleDanger]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right side */}
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <Text style={[styles.rowChevron, danger && styles.rowChevronDanger]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

export function SettingsScreen({ navigation }: Props) {
  const [pairing, setPairing] = useState<PairingData | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getPairing().then(setPairing);
  }, []);

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      "This will remove your pairing and clear all messages. You'll need a new pairing code to reconnect.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await clearPairing();
            await clearMessages();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Pairing' }],
            });
          },
        },
      ],
    );
  };

  const serverUrl = pairing?.url
    ? (() => {
        try { return new URL(pairing.url).hostname; } catch { return pairing.url; }
      })()
    : 'Unknown';

  return (
    <View style={styles.container}>
      {/* Nebula glows */}
      <View style={styles.nebulaLeft} />
      <View style={styles.nebulaRight} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMini}>
            <Image source={owlLogo} style={styles.logoMiniImg} />
          </View>
          <Text style={styles.headerBrand}>Wakeel</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero headline */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroSubtitle}>
            Manage your account and preferences.
          </Text>
        </View>

        {/* Connection section */}
        <View style={styles.section}>
          <SettingsRow
            icon="⚡"
            iconColor={colors.primaryTextGold}
            iconBg="rgba(242,202,80,0.1)"
            title="Connection"
            subtitle="Advanced Connectivity Protocols"
            value={pairing?.name || 'Wakeel'}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="🌐"
            iconColor={colors.secondary}
            iconBg="rgba(98,0,234,0.1)"
            title="Language"
            subtitle="Language & Dialect Settings"
            value="English"
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="🛡"
            iconColor={colors.onSurfaceVariant}
            iconBg={colors.surfaceContainerHigh}
            title="Privacy"
            subtitle="Data Encryption & Security"
          />
        </View>

        {/* Connection info (read-only) */}
        {pairing && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Connected to</Text>
            <Text style={styles.infoValue}>{serverUrl}</Text>
          </View>
        )}

        {/* Disconnect */}
        <View style={[styles.section, styles.sectionSpaced]}>
          <SettingsRow
            icon="✕"
            iconColor={colors.error}
            iconBg="rgba(255,180,171,0.1)"
            title="Disconnect"
            subtitle="Terminate Current Session"
            danger
            onPress={handleDisconnect}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Wakeel · وکیل</Text>
          <Text style={styles.footerVersion}>v1.0.0 · Your Personal AI Agent</Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Documentation</Text>
            <Text style={styles.footerLinkSep}>·</Text>
            <Text style={styles.footerLink}>Privacy</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // Nebula
  nebulaLeft: {
    position: 'absolute',
    top: -50,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: colors.secondary,
    opacity: 0.06,
  },
  nebulaRight: {
    position: 'absolute',
    top: '40%',
    right: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primaryTextGold,
    opacity: 0.05,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(5,5,5,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMini: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  logoMiniImg: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.primaryTextGold,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.primaryGold,
    fontSize: 16,
    fontWeight: '300',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },

  // Hero
  heroSection: {
    marginBottom: spacing.xxl,
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: '700',
    fontStyle: 'italic',
    color: colors.primaryTextGold,
    letterSpacing: -1,
    lineHeight: 60,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '300',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.3,
    lineHeight: 22,
  },

  // Settings section card
  section: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  sectionSpaced: {
    marginTop: spacing.lg,
  },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginLeft: 72,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  rowDanger: {
    // No specific override needed — handled by text/icon colors
  },
  rowIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: {
    fontSize: 18,
  },
  rowTextGroup: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 20,
    fontWeight: '300',
    fontStyle: 'italic',
    color: colors.onSurface,
    letterSpacing: 0.2,
  },
  rowTitleDanger: {
    color: colors.error,
    opacity: 0.85,
  },
  rowSubtitle: {
    fontSize: 10,
    color: colors.outline,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rowSubtitleDanger: {
    color: colors.error,
    opacity: 0.45,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    color: colors.primaryTextGold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rowChevron: {
    color: colors.outline,
    fontSize: 22,
    opacity: 0.5,
  },
  rowChevronDanger: {
    color: colors.error,
  },

  // Info card
  infoCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: colors.outline,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    color: colors.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.xs,
    opacity: 0.35,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 4,
    color: colors.onSurface,
    textTransform: 'uppercase',
  },
  footerVersion: {
    fontSize: 10,
    color: colors.outline,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footerLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  footerLink: {
    fontSize: 10,
    color: colors.outline,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footerLinkSep: {
    color: colors.outlineVariant,
    fontSize: 10,
  },
});
