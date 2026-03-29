import React, { useEffect, useRef } from 'react';
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
import { RootStackParamList } from '../../types';

const owlLogo = require('../../../assets/owl-logo.png');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingReady'>;
  route: RouteProp<RootStackParamList, 'OnboardingReady'>;
};

export function ReadyScreen({ navigation, route }: Props) {
  const { wakeclName } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Owl with glow */}
          <View style={styles.logoContainer}>
            <Animated.View style={[styles.glowRing, { opacity: glowAnim }]} />
            <Image source={owlLogo} style={styles.owlImage} />
          </View>

          {/* Headlines */}
          <Text style={styles.headline}>Meet {wakeclName}</Text>
          <Text style={styles.subtitle}>Your personal AI is ready.</Text>
          <Text style={styles.tagline}>
            Say hello. They're already learning about you. 👋
          </Text>

          {/* Button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Chat' }],
              });
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>Start Chatting</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
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

  logoContainer: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primaryGold,
  },
  owlImage: {
    width: 140,
    height: 140,
    borderRadius: 20,
  },

  headline: {
    fontSize: 48,
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
    marginBottom: spacing.lg,
  },
  tagline: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.xxl + spacing.lg,
    letterSpacing: 0.3,
  },

  startButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 20,
    paddingHorizontal: spacing.xxl + spacing.xl,
    alignItems: 'center',
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  startButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
