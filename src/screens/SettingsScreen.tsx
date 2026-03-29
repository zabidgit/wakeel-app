import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  ScrollView,
  Platform,
  Image,
  Linking,
  Clipboard,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { getAccountInfo, getAccountToken, clearAccountToken, deleteAccount, createInvite } from '../auth';

const owlLogo = require('../../assets/owl-logo.png');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../theme';
import { getPairing, clearPairing, clearMessages, getChats, clearChatMessages } from '../storage';
import { PairingData, RootStackParamList } from '../types';

const PROVISION_API_URL = 'https://app.getwakeel.app';
const PROVISION_API_KEY = '2980112b9fb4789c5ffa9161a5a3bea2194cb41c8eb3990819567878a846dea5';

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
  const [accountInfo, setAccountInfo] = useState<Awaited<ReturnType<typeof getAccountInfo>>>(null);
  const [accountToken, setAccountToken] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useTheme();

  useEffect(() => {
    getPairing().then(setPairing);
    getAccountInfo().then(setAccountInfo);
    getAccountToken().then(setAccountToken);
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'You\'ll need to sign in again to access your Wakeel.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await clearAccountToken();
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          },
        },
      ],
    );
  };

  const handleThemeToggle = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Appearance',
        options: ['Dark Mode', 'Night Mode (warm amber)', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) setMode('dark');
        else if (buttonIndex === 1) setMode('night');
      },
    );
  };

  const handleInvite = async () => {
    if (!accountToken) {
      Alert.alert('Sign In Required', 'Please sign in to invite household members.');
      return;
    }
    try {
      const { inviteCode, expiresAt } = await createInvite(accountToken);
      const expiry = new Date(expiresAt).toLocaleString();
      Alert.alert(
        'Invite Code',
        `Share this code with a household member:\n\n${inviteCode}\n\nExpires: ${expiry}`,
        [
          { text: 'Copy Code', onPress: () => Clipboard.setString(inviteCode) },
          { text: 'Done', style: 'cancel' },
        ],
      );
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create invite.');
    }
  };

  const handleClearMessages = async () => {
    const chats = await getChats();
    const chatNames = chats.map(c => `${c.emoji} ${c.name}`);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Clear Messages',
        message: 'Choose which chat to clear:',
        options: [...chatNames, 'Clear All Chats', 'Cancel'],
        cancelButtonIndex: chatNames.length + 1,
        destructiveButtonIndex: chatNames.length, // "Clear All" is destructive
      },
      async (buttonIndex) => {
        if (buttonIndex === chatNames.length + 1) return; // Cancel

        if (buttonIndex === chatNames.length) {
          // Clear All
          Alert.alert(
            'Clear All Chats',
            'Delete ALL chat history? This can\'t be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear All',
                style: 'destructive',
                onPress: async () => {
                  await clearMessages();
                  for (const chat of chats) {
                    await clearChatMessages(chat.sessionKey);
                  }
                  Alert.alert('Done', 'All messages cleared.');
                  navigation.goBack();
                },
              },
            ],
          );
        } else {
          // Clear specific chat
          const chat = chats[buttonIndex];
          Alert.alert(
            `Clear ${chat.name}`,
            `Delete all messages in "${chat.name}"? This can't be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                  await clearChatMessages(chat.sessionKey);
                  if (chat.sessionKey === 'main') {
                    await clearMessages(); // Also clear legacy
                  }
                  Alert.alert('Done', `"${chat.name}" messages cleared.`);
                  navigation.goBack();
                },
              },
            ],
          );
        }
      },
    );
  };

  const handleCancelWakeel = () => {
    Alert.alert(
      'Cancel Wakeel',
      'This will permanently delete your Wakeel and all your data. This cannot be undone.',
      [
        { text: 'Keep My Wakeel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use account token if available (auth flow), otherwise direct API key
              const tok = await getAccountToken();
              if (tok) {
                await deleteAccount(tok);
              } else {
                const clientId = pairing?.url
                  ? new URL(pairing.url).hostname.split('.')[0]
                  : null;
                if (clientId) {
                  await fetch(`${PROVISION_API_URL}/api/provision/${clientId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${PROVISION_API_KEY}` },
                  });
                }
              }
            } catch { /* ignore server errors */ }

            await clearAccountToken();
            await clearPairing();
            await clearMessages();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          },
        },
      ],
    );
  };

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

        {/* Account section */}
        {accountInfo && (
          <View style={styles.section}>
            <SettingsRow
              icon={accountInfo.provider === 'apple' ? '🍎' : '🔵'}
              iconColor={colors.onSurfaceVariant}
              iconBg={colors.surfaceContainerHigh}
              title={accountInfo.email || (accountInfo.provider === 'apple' ? 'Apple Account' : 'Google Account')}
              subtitle={`Signed in with ${accountInfo.provider === 'apple' ? 'Apple' : 'Google'} · ${accountInfo.plan}`}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="🚪"
              iconColor="#FF9500"
              iconBg="rgba(255,149,0,0.1)"
              title="Sign Out"
              subtitle="Return to Login Screen"
              danger
              onPress={handleSignOut}
            />
          </View>
        )}

        {/* Appearance section */}
        <View style={[styles.section, accountInfo ? styles.sectionSpaced : undefined]}>
          <SettingsRow
            icon={mode === 'night' ? '🌙' : '🌑'}
            iconColor={mode === 'night' ? '#FFB347' : colors.onSurfaceVariant}
            iconBg={mode === 'night' ? 'rgba(255,179,71,0.1)' : colors.surfaceContainerHigh}
            title="Appearance"
            subtitle={mode === 'night' ? 'Night Mode (warm amber)' : 'Dark Mode'}
            value={mode === 'night' ? 'Night' : 'Dark'}
            onPress={handleThemeToggle}
          />
        </View>

        {/* Household invite section */}
        <View style={styles.section}>
          <SettingsRow
            icon="👨‍👩‍👦"
            iconColor={colors.secondary}
            iconBg="rgba(98,0,234,0.1)"
            title="Invite a Member"
            subtitle="Share Wakeel with Your Household"
            onPress={handleInvite}
          />
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
            onPress={() => Linking.openURL('https://app.getwakeel.app/privacy')}
          />
        </View>

        {/* Connection info (read-only) */}
        {pairing && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Connected to</Text>
            <Text style={styles.infoValue}>{serverUrl}</Text>
          </View>
        )}

        {/* Clear messages & Disconnect */}
        <View style={[styles.section, styles.sectionSpaced]}>
          <SettingsRow
            icon="🗑"
            iconColor={colors.warning}
            iconBg="rgba(243,156,18,0.1)"
            title="Clear Messages"
            subtitle="Delete Chat History"
            onPress={handleClearMessages}
          />
          <View style={styles.rowDivider} />
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

        {/* Cancel Wakeel — nuclear option */}
        <View style={[styles.section, styles.sectionSpaced]}>
          <SettingsRow
            icon="🗑"
            iconColor="#FF3B30"
            iconBg="rgba(255,59,48,0.12)"
            title="Cancel Wakeel"
            subtitle="Delete Account & All Data"
            danger
            onPress={handleCancelWakeel}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Wakeel · وکیل</Text>
          <Text style={styles.footerVersion}>v1.0.0 · Your Personal AI Agent</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://getwakeel.app')}>
              <Text style={styles.footerLink}>Website</Text>
            </TouchableOpacity>
            <Text style={styles.footerLinkSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://app.getwakeel.app/privacy')}>
              <Text style={styles.footerLink}>Privacy</Text>
            </TouchableOpacity>
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
    letterSpacing: 2,
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
