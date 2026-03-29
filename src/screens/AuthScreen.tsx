import React, { useEffect, useState } from 'react';
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
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing } from '../theme';
import { RootStackParamList } from '../types';
import {
  signInWithGoogleOnServer,
  saveAccountToken,
  saveAccountInfo,
  fetchAccountAndPairing,
} from '../auth';
import { savePairing, getPairing } from '../storage';

// Note: expo-web-browser maybeCompleteAuthSession is handled internally by expo-auth-session on mobile

const owlLogo = require('../../assets/owl-logo.png');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
};

export function AuthScreen({ navigation }: Props) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const googleClientId = Constants.expoConfig?.extra?.googleClientIdIos || '';

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: googleClientId || undefined,
    redirectUri: makeRedirectUri({ scheme: 'com.getwakeel.app', path: 'auth' }),
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) {
        handleGoogleServerAuth(idToken);
      } else {
        setLoadingGoogle(false);
        Alert.alert('Sign In Failed', 'Could not get Google ID token. Please try again.');
      }
    } else if (googleResponse?.type === 'error') {
      setLoadingGoogle(false);
      Alert.alert('Sign In Failed', googleResponse.error?.message || 'Google sign-in failed.');
    } else if (googleResponse?.type === 'dismiss') {
      setLoadingGoogle(false);
    }
  }, [googleResponse]);

  async function handleGoogleServerAuth(idToken: string) {
    try {
      const result = await signInWithGoogleOnServer(idToken);
      await saveAccountToken(result.accountToken);
      await saveAccountInfo(result.account);
      await navigateAfterAuth(result.accountToken, result.isNewUser);
    } catch (e: unknown) {
      setLoadingGoogle(false);
      Alert.alert('Sign In Failed', e instanceof Error ? e.message : 'Google sign-in failed.');
    }
  }

  async function navigateAfterAuth(accountToken: string, isNewUser: boolean) {
    if (isNewUser) {
      navigation.reset({ index: 0, routes: [{ name: 'OnboardingName', params: { accountToken } }] });
      return;
    }
    // Returning user — check if they have a provisioned container
    try {
      const { pairing } = await fetchAccountAndPairing(accountToken);
      if (pairing) {
        await savePairing(pairing);
        navigation.reset({ index: 0, routes: [{ name: 'Chat' }] });
      } else {
        // Logged in but not provisioned yet
        navigation.reset({ index: 0, routes: [{ name: 'OnboardingName', params: { accountToken } }] });
      }
    } catch {
      navigation.reset({ index: 0, routes: [{ name: 'OnboardingName', params: { accountToken } }] });
    }
  }

  const handleAppleSignIn = async () => {
    // Apple Sign-In requires expo-apple-authentication native module.
    // This will be available in a future build with the entitlement enabled.
    Alert.alert('Coming Soon', 'Apple Sign-In will be available in the next update.');
  };

  const handleGoogleSignIn = async () => {
    if (loadingGoogle) return;
    if (!googleClientId) {
      Alert.alert('Coming Soon', 'Google sign-in will be available soon.');
      return;
    }
    setLoadingGoogle(true);
    promptGoogleAsync();
  };

  const handleManualConnect = () => {
    navigation.navigate('Pairing');
  };

  return (
    <View style={styles.container}>
      {/* Nebula glows */}
      <View style={styles.nebulaTop} />
      <View style={styles.nebulaBottom} />

      <SafeAreaView style={styles.safeArea}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoRing}>
            <Image source={owlLogo} style={styles.logoImage} />
          </View>
          <Text style={styles.brandName}>Wakeel</Text>
          <Text style={styles.brandArabic}>وکیل</Text>
          <Text style={styles.tagline}>Your personal AI agent</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonSection}>
          {/* Apple Sign In (stub — native module not available in this build) */}
          <TouchableOpacity
            style={[styles.appleButtonFallback]}
            onPress={handleAppleSignIn}
            activeOpacity={0.85}
          >
            <Text style={styles.appleIcon}>  Apple</Text>
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          </TouchableOpacity>

          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.googleButton, loadingGoogle && styles.buttonLoading]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={loadingGoogle}
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

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Manual connect */}
          <TouchableOpacity
            style={styles.manualButton}
            onPress={handleManualConnect}
            activeOpacity={0.7}
            disabled={loadingGoogle}
          >
            <Text style={styles.manualButtonText}>Connect manually</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },

  nebulaTop: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.08,
  },
  nebulaBottom: {
    position: 'absolute',
    bottom: -100,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.primaryGold,
    opacity: 0.07,
  },

  // Logo section
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  brandName: {
    fontSize: 40,
    fontWeight: '200',
    letterSpacing: 6,
    color: colors.primaryTextGold,
  },
  brandArabic: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 4,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '300',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },

  // Buttons
  buttonSection: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  appleButtonFallback: {
    height: 52,
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  appleIcon: {
    fontSize: 16,
    color: '#000',
  },
  appleButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  googleButton: {
    height: 52,
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonLoading: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
  },
  dividerText: {
    color: colors.outline,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  manualButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  manualButtonText: {
    color: colors.outline,
    fontSize: 13,
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  footerText: {
    fontSize: 11,
    color: colors.outline,
    opacity: 0.6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
