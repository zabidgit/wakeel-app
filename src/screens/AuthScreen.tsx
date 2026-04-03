import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  isSuccessResponse,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';

import { useTheme } from '../ThemeContext';
import { spacing } from '../theme';
import { RootStackParamList } from '../types';
import {
  signInWithAppleOnServer,
  signInWithGoogleOnServer,
  saveAccountToken,
  saveAccountInfo,
  fetchAccountAndPairing,
} from '../auth';
import { savePairing } from '../storage';

const owlLogo = require('../../assets/owl-logo.png');

// Configure Google Sign-In once at module level
GoogleSignin.configure({
  iosClientId: '916114118457-5k6k0hnl4rd70m064m8kkjalrsr5t922.apps.googleusercontent.com',
  webClientId: '916114118457-5k6k0hnl4rd70m064m8kkjalrsr5t922.apps.googleusercontent.com',
});

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
};

export function AuthScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [loadingApple, setLoadingApple] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Check Apple Sign-In availability (only on iOS 13+)
    AppleAuthentication.isAvailableAsync().then((available) => {
      if (mountedRef.current) setAppleAvailable(available);
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  async function navigateAfterAuth(accountToken: string, isNewUser: boolean, account?: { provider: string; email?: string; plan?: string }) {
    if (isNewUser) {
      // New user → onboarding. Account persisted AFTER provisioning succeeds.
      navigation.reset({ index: 0, routes: [{ name: 'OnboardingName', params: { accountToken, account } }] });
      return;
    }
    try {
      const { pairing } = await fetchAccountAndPairing(accountToken);
      if (pairing) {
        // Returning user with existing container — safe to persist now
        await saveAccountToken(accountToken);
        if (account) await saveAccountInfo(account);
        await savePairing(pairing);
        navigation.reset({ index: 0, routes: [{ name: 'Chat' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'OnboardingName', params: { accountToken, account } }] });
      }
    } catch {
      navigation.reset({ index: 0, routes: [{ name: 'OnboardingName', params: { accountToken, account } }] });
    }
  }

  // ── Apple Sign-In ─────────────────────────────────────────────────────────

  const handleAppleSignIn = async () => {
    if (loadingApple) return;
    setLoadingApple(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName, email } = credential;

      if (!identityToken) {
        throw new Error('No identity token received from Apple.');
      }

      // Build full name string from components (only available on first sign-in)
      let fullNameStr: string | null = null;
      if (fullName) {
        const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
        if (parts.length > 0) fullNameStr = parts.join(' ');
      }

      const result = await signInWithAppleOnServer(identityToken, fullNameStr, email);
      // Don't persist account yet — wait until provisioning succeeds (or existing pairing found)
      await navigateAfterAuth(result.accountToken, result.isNewUser, result.account);
    } catch (e: unknown) {
      // ERR_REQUEST_CANCELED means user dismissed the modal — don't show error
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') {
        // User cancelled, do nothing
      } else {
        Alert.alert('Sign In Failed', e instanceof Error ? e.message : 'Apple sign-in failed.');
      }
    } finally {
      if (mountedRef.current) setLoadingApple(false);
    }
  };

  // ── Google Sign-In ────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    if (loadingGoogle) return;
    setLoadingGoogle(true);

    try {
      const response = await GoogleSignin.signIn();

      if (isCancelledResponse(response)) {
        // User cancelled — do nothing
        if (mountedRef.current) setLoadingGoogle(false);
        return;
      }

      if (isSuccessResponse(response)) {
        const { idToken } = response.data;

        if (!idToken) {
          throw new Error('No ID token received from Google.');
        }

        const result = await signInWithGoogleOnServer(idToken);
        // Don't persist account yet — wait until provisioning succeeds (or existing pairing found)
        await navigateAfterAuth(result.accountToken, result.isNewUser, result.account);
      }
    } catch (e: unknown) {
      Alert.alert('Sign In Failed', e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      if (mountedRef.current) setLoadingGoogle(false);
    }
  };

  // ── Manual Connect ────────────────────────────────────────────────────────

  const handleManualConnect = () => {
    navigation.navigate('Pairing');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = loadingApple || loadingGoogle;

  return (
    <View style={styles.container}>
      <View style={styles.nebulaTop} />
      <View style={styles.nebulaBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoSection}>
          <View style={styles.logoRing}>
            <Image source={owlLogo} style={styles.logoImage} />
          </View>
          <Text style={styles.brandName}>Wakeel</Text>
          <Text style={styles.brandArabic}>وکیل</Text>
          <Text style={styles.tagline}>Your personal AI agent</Text>
        </View>

        <View style={styles.buttonSection}>
          {/* Apple Sign-In — native button required by App Store */}
          {appleAvailable && (
            <View style={loadingApple ? styles.buttonLoading : undefined}>
              {loadingApple ? (
                <View style={styles.appleLoadingContainer}>
                  <ActivityIndicator color="#000" size="small" />
                </View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={14}
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                />
              )}
            </View>
          )}

          {/* Fallback for simulators / Android where Apple auth isn't available */}
          {!appleAvailable && (
            <TouchableOpacity
              style={styles.appleButtonFallback}
              onPress={() => Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices.')}
              activeOpacity={0.85}
            >
              <Text style={styles.appleIcon}> Apple</Text>
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.googleButton, loadingGoogle && styles.buttonLoading]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {loadingGoogle ? (
              <ActivityIndicator color="#444" size="small" />
            ) : (
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.manualButton}
            onPress={handleManualConnect}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={styles.manualButtonText}>Connect manually</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof import('../ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.lg },
    nebulaTop: { position: 'absolute', top: -120, left: -100, width: 380, height: 380, borderRadius: 190, backgroundColor: colors.secondaryContainer, opacity: 0.08 },
    nebulaBottom: { position: 'absolute', bottom: -100, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: colors.primaryGold, opacity: 0.07 },
    logoSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    logoRing: { width: 100, height: 100, borderRadius: 24, borderWidth: 2, borderColor: '#C9A84C', overflow: 'hidden', marginBottom: spacing.sm, backgroundColor: '#0B1120' },
    logoImage: { width: '100%' as any, height: '100%' as any },
    brandName: { fontSize: 40, fontWeight: '200', letterSpacing: 6, color: colors.primaryTextGold },
    brandArabic: { fontSize: 18, fontWeight: '300', letterSpacing: 4, color: colors.onSurfaceVariant, opacity: 0.6 },
    tagline: { fontSize: 12, fontWeight: '300', color: colors.outline, letterSpacing: 3, textTransform: 'uppercase', marginTop: spacing.xs },
    buttonSection: { gap: spacing.sm, paddingBottom: spacing.md },
    // Native Apple button
    appleButton: { height: 52, width: '100%' },
    appleLoadingContainer: { height: 52, backgroundColor: '#fff', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    // Fallback Apple button (for non-iOS)
    appleButtonFallback: { height: 52, backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    appleIcon: { fontSize: 16, color: '#000' },
    appleButtonText: { color: '#000', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
    // Google button
    googleButton: { height: 52, backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
    googleG: { fontSize: 18, fontWeight: '700', color: '#4285F4', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
    googleButtonText: { color: '#333', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
    buttonLoading: { opacity: 0.5 },
    // Divider
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs, gap: spacing.sm },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
    dividerText: { color: colors.outline, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
    // Manual connect
    manualButton: { alignItems: 'center', paddingVertical: spacing.sm },
    manualButtonText: { color: colors.outline, fontSize: 13, letterSpacing: 1, textDecorationLine: 'underline' },
    // Footer
    footer: { alignItems: 'center', paddingBottom: spacing.md },
    footerText: { fontSize: 11, color: colors.outline, opacity: 0.6, letterSpacing: 0.3, textAlign: 'center' },
    footerLink: { textDecorationLine: 'underline' },
  });
}
