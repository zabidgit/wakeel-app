import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WhatCanWakeelDo'>;
  route: RouteProp<RootStackParamList, 'WhatCanWakeelDo'>;
};

interface FeatureRowProps {
  emoji: string;
  text: string;
}

function FeatureRow({ emoji, text }: FeatureRowProps) {
  return (
    <View style={featureStyles.row}>
      <Text style={featureStyles.emoji}>{emoji}</Text>
      <Text style={featureStyles.text}>{text}</Text>
    </View>
  );
}

interface SectionProps {
  icon: string;
  title: string;
  features: { emoji: string; text: string }[];
}

function FeatureSection({ icon, title, features }: SectionProps) {
  return (
    <View style={featureStyles.section}>
      <View style={featureStyles.sectionHeader}>
        <Text style={featureStyles.sectionIcon}>{icon}</Text>
        <Text style={featureStyles.sectionTitle}>{title}</Text>
      </View>
      <View style={featureStyles.sectionBody}>
        {features.map((f, i) => (
          <FeatureRow key={i} emoji={f.emoji} text={f.text} />
        ))}
      </View>
    </View>
  );
}

const SECTIONS: SectionProps[] = [
  {
    icon: '🧠',
    title: 'Remember Everything',
    features: [
      { emoji: '·', text: 'Knows your preferences, routine, and the people in your life' },
      { emoji: '·', text: 'Learns how you like things done — no repeat explanations' },
      { emoji: '·', text: 'Builds context over time, so every conversation gets sharper' },
    ],
  },
  {
    icon: '📍',
    title: 'Location-Aware',
    features: [
      { emoji: '·', text: 'Reminds you about your shopping list when you\'re near the store' },
      { emoji: '·', text: 'Knows when you\'re heading home and prepares you' },
      { emoji: '·', text: 'Surfaces local info that\'s actually relevant to where you are' },
    ],
  },
  {
    icon: '📅',
    title: 'Calendar & Time',
    features: [
      { emoji: '·', text: 'Reads your calendar and gives you daily briefings' },
      { emoji: '·', text: 'Schedules events, blocks time, and sets reminders on your behalf' },
      { emoji: '·', text: 'Makes sure you\'re never caught off guard by what\'s next' },
    ],
  },
  {
    icon: '💬',
    title: 'Just Ask',
    features: [
      { emoji: '·', text: 'Answer questions, research anything, draft messages and emails' },
      { emoji: '·', text: 'Handle tasks and follow-ups while you\'re busy' },
      { emoji: '·', text: 'Think out loud — your Wakeel thinks back' },
    ],
  },
  {
    icon: '🔔',
    title: 'Proactive Nudges',
    features: [
      { emoji: '·', text: 'Reminds you before you forget, not after' },
      { emoji: '·', text: 'Checks in on things you care about' },
      { emoji: '·', text: 'Surfaces the one thing worth your attention right now' },
    ],
  },
  {
    icon: '🔒',
    title: 'Private by Design',
    features: [
      { emoji: '·', text: 'Your data stays on your device — never on shared servers' },
      { emoji: '·', text: 'No data mining, no selling your habits' },
      { emoji: '·', text: 'Apple-level privacy — your Wakeel is yours alone' },
    ],
  },
];

export function WhatCanWakeelDoScreen({ navigation, route }: Props) {
  const { fromOnboarding, wakeclName } = route.params ?? {};

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 12,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDone = () => {
    navigation.goBack();
  };

  const agentName = wakeclName || 'your Wakeel';

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header bar */}
        {!fromOnboarding && (
          <TouchableOpacity style={styles.closeButton} onPress={handleDone} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        )}

        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View style={[styles.hero, { transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.eyebrow}>CAPABILITIES</Text>
            <Text style={styles.headline}>What can {agentName} do?</Text>
            <Text style={styles.subheadline}>
              More than a chatbot. A personal assistant that actually knows you.
            </Text>
          </Animated.View>

          {/* Feature Sections */}
          <View style={styles.sections}>
            {SECTIONS.map((section, i) => (
              <FeatureSection key={i} {...section} />
            ))}
          </View>

          {/* Closing line */}
          <View style={styles.closing}>
            <View style={styles.closingDivider} />
            <Text style={styles.closingText}>
              When in doubt, just ask your Wakeel.
            </Text>
            <View style={styles.closingDivider} />
          </View>

          {/* CTA */}
          <View style={styles.ctaContainer}>
            <TouchableOpacity style={styles.ctaButton} onPress={handleDone} activeOpacity={0.85}>
              <Text style={styles.ctaButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Feature Styles ───────────────────────────────────────────────────────────
const featureStyles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryTextGold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionBody: {
    paddingLeft: 4,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emoji: {
    color: colors.primaryGold,
    fontSize: 16,
    marginRight: 10,
    lineHeight: 22,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
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
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.lg,
  },
  closeText: {
    color: colors.outline,
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    paddingTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryGold,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  headline: {
    fontSize: 36,
    fontWeight: '300',
    fontStyle: 'italic',
    color: colors.primaryTextGold,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  subheadline: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  sections: {
    gap: 0,
  },
  closing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxl,
    gap: spacing.md,
  },
  closingDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.outlineVariant,
  },
  closingText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryGold,
    textAlign: 'center',
    fontStyle: 'italic',
    flexShrink: 1,
  },
  ctaContainer: {
    paddingBottom: spacing.lg,
  },
  ctaButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  ctaButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
