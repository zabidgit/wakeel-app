import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { RootStackParamList, PairingData } from '../../types';
import { savePairing, clearMessages } from '../../storage';
import { provisionWithAccountToken, saveAccountToken, saveAccountInfo } from '../../auth';

const PROVISION_API_URL = 'https://app.getwakeel.app';
const PROVISION_API_KEY = '2980112b9fb4789c5ffa9161a5a3bea2194cb41c8eb3990819567878a846dea5';

const owlLogo = require('../../../assets/owl-logo.png');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingProvisioning'>;
  route: RouteProp<RootStackParamList, 'OnboardingProvisioning'>;
};

const STEPS = [
  'Preparing your space...',
  'Teaching {name} about you...',
  'Connecting...',
  'Almost there...',
];

export function ProvisioningScreen({ navigation, route }: Props) {
  const { data, accountToken, account } = route.params;
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headlineFade = useRef(new Animated.Value(0)).current;

  // Headline fade animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(headlineFade, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(headlineFade, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Pulse animation for owl
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Fade in
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Provisioning logic
  useEffect(() => {
    let cancelled = false;

    const provision = async () => {
      try {
        // Step 0: Preparing
        setCurrentStep(0);
        await delay(1500);
        if (cancelled) return;

        // Step 1: Teaching
        setCurrentStep(1);
        await delay(1000);
        if (cancelled) return;

        // Make the API call — use accountToken if available (auth flow), otherwise direct API key (dev/manual)
        const onboardingBody = {
          wakeclName: data.wakeclName,
          userName: data.userName,
          userNickname: data.userNickname,
          userTimezone: data.userTimezone,
          partnerName: data.partnerName,
          familyMembers: data.familyMembers,
          personality: data.personality,
          proactiveness: data.proactiveness,
        };

        let pairingData: PairingData;
        if (accountToken) {
          // Auth flow: provision via account token
          const result = await provisionWithAccountToken(accountToken, onboardingBody);
          pairingData = result;
        } else {
          // Dev/manual flow: direct API key provision
          const response = await fetch(`${PROVISION_API_URL}/api/provision`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PROVISION_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(onboardingBody),
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Provisioning failed (${response.status})`);
          }
          const result = await response.json();
          pairingData = { url: result.url, token: result.token, name: result.name || data.wakeclName };
        }

        if (cancelled) return;

        // Step 2: Connecting
        setCurrentStep(2);
        await delay(1500);
        if (cancelled) return;
        await clearMessages(); // Fresh container = fresh chat
        await savePairing(pairingData);
        // Persist account NOW — provisioning succeeded
        if (accountToken) await saveAccountToken(accountToken);
        if (account) await saveAccountInfo(account);

        if (cancelled) return;

        // Step 3: Almost there
        setCurrentStep(3);
        await delay(1000);
        if (cancelled) return;

        // Done — navigate to ready screen
        navigation.replace('OnboardingReady', { wakeclName: data.wakeclName });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Something went wrong. Please try again.');
        }
      }
    };

    provision();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRetry = () => {
    setError('');
    setCurrentStep(0);
    // Re-trigger by navigating to self
    navigation.replace('OnboardingProvisioning', { data });
  };

  const steps = STEPS.map((s) => s.replace('{name}', data.wakeclName));

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Animated headline */}
          <Animated.Text style={[styles.headline, { opacity: headlineFade }]}>
            Setting up...
          </Animated.Text>
          <Text style={styles.subtitle}>
            Creating your Wakeel. This takes about 2 minutes.
          </Text>

          {/* Animated owl */}
          <Animated.View style={[styles.logoSection, { transform: [{ scale: pulseAnim }] }]}>
            <Image source={owlLogo} style={styles.owlImage} />
          </Animated.View>

          {/* Progress steps */}
          <View style={styles.steps}>
            {steps.map((step, index) => {
              const isComplete = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <View key={index} style={styles.stepRow}>
                  <Text style={styles.stepIcon}>
                    {isComplete ? '✅' : isCurrent ? '⏳' : '○'}
                  </Text>
                  <Text
                    style={[
                      styles.stepText,
                      isComplete && styles.stepTextComplete,
                      isCurrent && styles.stepTextCurrent,
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Error state */}
          {error ? (
            <View style={styles.errorSection}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
                activeOpacity={0.85}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: { flex: 1 },

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

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },

  headline: {
    fontSize: 44,
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
    marginBottom: spacing.xxl,
  },

  logoSection: {
    marginBottom: spacing.xxl,
  },
  owlImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#C9A84C',
    backgroundColor: '#0B1120',
  },

  steps: {
    width: '100%',
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  stepText: {
    color: colors.outlineVariant,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  stepTextComplete: {
    color: colors.success,
  },
  stepTextCurrent: {
    color: colors.onSurface,
  },

  errorSection: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  retryButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  retryButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
