import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { RootStackParamList } from '../../types';
import { getPairing } from '../../storage';
import { fetchWithTimeout } from '../../fetchWithTimeout';
import { PROVISION_API_URL } from '../../constants';

const owlLogo = require('../../../assets/owl-logo.png');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingReady'>;
  route: RouteProp<RootStackParamList, 'OnboardingReady'>;
};

interface Interest {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

const INTERESTS: Interest[] = [
  {
    id: 'calendar',
    emoji: '📅',
    title: 'Calendar & Schedule',
    description: 'Daily briefings, event management, never miss a meeting',
  },
  {
    id: 'memory',
    emoji: '🧠',
    title: 'Remember Everything',
    description: 'Learn your preferences, people, and how you like things',
  },
  {
    id: 'location',
    emoji: '📍',
    title: 'Location Aware',
    description: 'Reminders near places, local info, context from where you are',
  },
  {
    id: 'nudges',
    emoji: '🔔',
    title: 'Proactive Nudges',
    description: 'Check in on things you care about, timely heads-ups',
  },
  {
    id: 'research',
    emoji: '💬',
    title: 'Research & Writing',
    description: 'Draft emails, answer questions, think things through together',
  },
  {
    id: 'tasks',
    emoji: '✅',
    title: 'Tasks & Follow-ups',
    description: 'Track to-dos, follow up on commitments, stay accountable',
  },
];

export function ReadyScreen({ navigation, route }: Props) {
  const { wakeclName } = route.params;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hero entrance
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

    // Cards fade in after hero
    Animated.timing(cardsAnim, {
      toValue: 1,
      duration: 600,
      delay: 400,
      useNativeDriver: true,
    }).start();

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

  const toggleInterest = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    // Build a context message from selected interests
    if (selected.size > 0) {
      const selectedItems = INTERESTS.filter(i => selected.has(i.id));
      const interestList = selectedItems.map(i => `${i.emoji} ${i.title}`).join('\n');
      const message = `[System context — user's priorities]\nDuring onboarding, your human selected these as things they'd like your help with:\n\n${interestList}\n\nPrioritize these areas. Proactively offer help in these domains. This is what matters most to them right now.`;

      // Send as first message via the provisioning server relay
      try {
        const pairing = await getPairing();
        if (pairing) {
          await fetchWithTimeout(`${pairing.url}/`, {
            method: 'GET',
          }, 3000).catch(() => {}); // Wake the gateway

          // We'll send this as the first chat message when the chat screen loads
          // Store it so ChatScreen can pick it up
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('wakeel_onboarding_context', message);
        }
      } catch {
        // Best effort — don't block navigation
      }
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Chat' }],
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <Animated.View
            style={[
              styles.heroSection,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.logoContainer}>
              <Animated.View style={[styles.glowRing, { opacity: glowAnim }]} />
              <Image source={owlLogo} style={styles.owlImage} />
            </View>

            <Text style={styles.headline}>Meet {wakeclName}</Text>
            <Text style={styles.subtitle}>Your personal AI is ready</Text>
            <Text style={styles.tagline}>
              What would you like help with? Pick as many as you'd like.
            </Text>
          </Animated.View>

          {/* Interest Cards */}
          <Animated.View style={[styles.cardsSection, { opacity: cardsAnim }]}>
            {INTERESTS.map(interest => {
              const isSelected = selected.has(interest.id);
              return (
                <TouchableOpacity
                  key={interest.id}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => toggleInterest(interest.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardEmoji}>{interest.emoji}</Text>
                  <View style={styles.cardTextContainer}>
                    <Text
                      style={[
                        styles.cardTitle,
                        isSelected && styles.cardTitleSelected,
                      ]}
                    >
                      {interest.title}
                    </Text>
                    <Text style={styles.cardDescription}>
                      {interest.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>Start Chatting</Text>
          </TouchableOpacity>
          {selected.size === 0 && (
            <Text style={styles.skipHint}>
              You can skip this — {wakeclName} will learn as you go
            </Text>
          )}
        </View>
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

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  logoContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primaryGold,
  },
  owlImage: {
    width: 100,
    height: 100,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#C9A84C',
    backgroundColor: '#0B1120',
  },
  headline: {
    fontSize: 42,
    fontWeight: '300',
    fontStyle: 'italic',
    color: colors.primaryTextGold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 22,
  },

  // Cards
  cardsSection: {
    gap: spacing.sm + 2,
  },
  card: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardSelected: {
    borderColor: colors.primaryGold,
    backgroundColor: colors.primaryGold + '10',
  },
  cardEmoji: {
    fontSize: 24,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.primaryTextGold,
  },
  cardDescription: {
    fontSize: 12,
    color: colors.outline,
    letterSpacing: 0.3,
    lineHeight: 17,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: colors.surfaceContainerLowest,
    fontSize: 14,
    fontWeight: '700',
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 18,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  skipHint: {
    fontSize: 12,
    color: colors.outline,
    marginTop: spacing.sm + 2,
    letterSpacing: 0.3,
  },
});
