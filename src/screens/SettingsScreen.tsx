import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OwlLogo } from '../components/OwlLogo';
import { colors, spacing } from '../theme';
import { getPairing, clearPairing, clearMessages } from '../storage';
import { PairingData, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

function SettingsRow({ label, value, danger }: { label: string; value?: string; danger?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const [pairing, setPairing] = useState<PairingData | null>(null);

  useEffect(() => {
    getPairing().then(setPairing);
  }, []);

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'This will remove your pairing and clear all messages. You\'ll need a new pairing code to reconnect.',
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
    ? new URL(pairing.url).hostname
    : 'Unknown';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <OwlLogo size={80} showTitle={false} showTagline={false} />
        </View>

        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONNECTION</Text>
          <View style={styles.sectionContent}>
            <SettingsRow label="Wakeel" value={pairing?.name || 'Wakeel'} />
            <SettingsRow label="Server" value={serverUrl} />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.sectionContent}>
            <SettingsRow label="Version" value="1.0.0" />
            <TouchableOpacity style={styles.row}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Text style={styles.rowChevron}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.row}>
              <Text style={styles.rowLabel}>Terms of Service</Text>
              <Text style={styles.rowChevron}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            activeOpacity={0.7}
          >
            <Text style={styles.disconnectText}>Disconnect & Clear Data</Text>
          </TouchableOpacity>
          <Text style={styles.disconnectNote}>
            This removes your pairing and deletes all local messages.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Wakeel · وکیل</Text>
          <Text style={styles.footerSubtext}>Your Personal AI Agent</Text>
          <Text style={styles.footerSubtext}>getwakeel.com</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.sm,
    backgroundColor: colors.darkGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  backButton: {
    width: 70,
  },
  backText: {
    color: colors.gold,
    fontSize: 16,
  },
  headerTitle: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sectionContent: {
    backgroundColor: colors.darkGray,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  rowLabel: {
    color: colors.cream,
    fontSize: 15,
  },
  rowLabelDanger: {
    color: colors.error,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
  rowChevron: {
    color: colors.textMuted,
    fontSize: 16,
  },
  disconnectButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  disconnectText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  disconnectNote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
    gap: 4,
  },
  footerText: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 3,
  },
  footerSubtext: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
