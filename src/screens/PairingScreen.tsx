import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OwlLogo } from '../components/OwlLogo';
import { colors, spacing } from '../theme';
import { savePairing } from '../storage';
import { PairingData, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Pairing'>;
};

export function PairingScreen({ navigation }: Props) {
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <OwlLogo size={140} />
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Enter your pairing code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setError('');
            }}
            placeholder="Paste your code here"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don't have a code?
          </Text>
          <Text style={styles.footerLink}>
            Visit getwakeel.com
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  inputSection: {
    gap: spacing.md,
  },
  label: {
    color: colors.cream,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  input: {
    backgroundColor: colors.darkGray,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.cream,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: colors.mediumGray,
    minHeight: 80,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginTop: -spacing.sm,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: 4,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footerLink: {
    color: colors.gold,
    fontSize: 13,
    opacity: 0.8,
  },
});
