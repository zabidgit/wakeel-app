import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing } from '../theme';
import { getThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';

const owlLogo = require('../../assets/owl-logo.png');
import { savePairing } from '../storage';
import { PairingData, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Pairing'>;
};

export function PairingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!code.trim()) {
      setError('Please enter a pairing code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Decode base64 pairing code
      const decoded = atob(code.trim());
      const pairing: PairingData = JSON.parse(decoded);

      if (!pairing.url || !pairing.token) {
        throw new Error('Invalid pairing code');
      }

      // Save pairing data securely
      await savePairing(pairing);

      // Navigate to chat
      navigation.reset({
        index: 0,
        routes: [{ name: 'Chat' }],
      });
    } catch (e) {
      setError('Invalid pairing code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Nebula glow — purple top-left */}
      <View style={styles.nebulaTopLeft} />
      {/* Nebula glow — gold bottom-right */}
      <View style={styles.nebulaBottomRight} />

      {/* Safe area + keyboard avoidance */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerBrand}>Wakeel</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoSection}>
              <Image source={owlLogo} style={styles.owlImage} />
            </View>

            {/* Headlines */}
            <View style={styles.headlines}>
              <Text style={styles.headline}>Pair Device</Text>
              <Text style={styles.subtitle}>Connect to your personal AI agent.</Text>
            </View>

            {/* Form card */}
            <View style={styles.card}>
              {/* Input label */}
              <Text style={styles.inputLabel}>Pairing Code</Text>

              {/* Code input */}
              <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={(text) => {
                    setCode(text);
                    setError('');
                  }}
                  placeholder="Enter your code"
                  placeholderTextColor={colors.outline}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Error */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Connect button */}
              <TouchableOpacity
                style={[styles.connectButton, loading && styles.connectButtonDisabled]}
                onPress={handleConnect}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.surfaceContainerLowest} size="small" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <Text style={styles.dividerText}>or</Text>
              </View>

              {/* Scan QR button */}
              <TouchableOpacity style={styles.qrButton} activeOpacity={0.75}>
                <Text style={styles.qrButtonText}>⬛  Scan QR Code</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>End-to-End Encrypted</Text>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // Nebula glow circles
  nebulaTopLeft: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.12,
  },
  nebulaBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primaryGold,
    opacity: 0.07,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.primaryTextGold,
  },

  // Scroll
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  // Logo
  logoSection: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  owlImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#C9A84C',
    backgroundColor: '#0B1120',
  },

  // Headlines
  headlines: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  headline: {
    fontSize: 40,
    fontWeight: '300',
    fontStyle: 'italic',
    color: colors.primaryTextGold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // Form card
  card: {
    width: '100%',
    gap: spacing.md,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
  },
  inputWrapper: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 16,
    overflow: 'hidden',
    opacity: 0.85,
  },
  inputWrapperError: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    fontSize: 15,
    letterSpacing: 2,
    textAlign: 'center',
    minHeight: 80,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginLeft: spacing.md,
  },
  connectButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    // Subtle glow shadow
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
    marginTop: spacing.sm,
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  divider: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dividerText: {
    fontSize: 10,
    color: colors.outlineVariant,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  qrButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingVertical: 16,
    alignItems: 'center',
    opacity: 0.7,
  },
  qrButtonText: {
    color: colors.onSurfaceVariant,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  footerText: {
    fontSize: 10,
    color: colors.outlineVariant,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
