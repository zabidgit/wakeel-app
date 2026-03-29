import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { RootStackParamList, OnboardingData } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingPersonality'>;
  route: RouteProp<RootStackParamList, 'OnboardingPersonality'>;
};

type Tone = 'professional' | 'balanced' | 'casual';
type Initiative = 'quiet' | 'moderate' | 'proactive';

interface CardOption<T> {
  key: T;
  emoji: string;
  title: string;
  description: string;
}

const TONE_OPTIONS: CardOption<Tone>[] = [
  { key: 'professional', emoji: '🎯', title: 'Professional', description: 'Clear, structured, business-like' },
  { key: 'balanced', emoji: '⚖️', title: 'Balanced', description: 'Friendly but focused' },
  { key: 'casual', emoji: '😎', title: 'Casual', description: 'Like texting a friend' },
];

const INITIATIVE_OPTIONS: CardOption<Initiative>[] = [
  { key: 'quiet', emoji: '🤫', title: 'Just answer', description: 'Only respond when asked' },
  { key: 'moderate', emoji: '💡', title: 'Suggest sometimes', description: 'Offer help when relevant' },
  { key: 'proactive', emoji: '🚀', title: 'Think ahead', description: 'Proactively anticipate my needs' },
];

export function PersonalityScreen({ navigation, route }: Props) {
  const { wakeclName, userName, userNickname, userTimezone, partnerName, familyMembers, accountToken } = route.params;
  const [tone, setTone] = useState<Tone>('balanced');
  const [initiative, setInitiative] = useState<Initiative>('moderate');

  const handleContinue = () => {
    const data: OnboardingData = {
      wakeclName,
      userName,
      userNickname,
      userTimezone,
      partnerName,
      familyMembers,
      personality: tone,
      proactiveness: initiative,
    };
    navigation.navigate('OnboardingProvisioning', { data, accountToken });
  };

  function renderCard<T extends string>(
    option: CardOption<T>,
    selected: T,
    onSelect: (key: T) => void,
  ) {
    const isSelected = selected === option.key;
    return (
      <TouchableOpacity
        key={option.key}
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => onSelect(option.key)}
        activeOpacity={0.7}
      >
        <Text style={styles.cardEmoji}>{option.emoji}</Text>
        <View style={styles.cardTextGroup}>
          <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
            {option.title}
          </Text>
          <Text style={styles.cardDescription}>{option.description}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headlines}>
            <Text style={styles.headline}>Your style</Text>
            <Text style={styles.subtitle}>How should your Wakeel talk?</Text>
          </View>

          {/* Tone */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tone</Text>
            {TONE_OPTIONS.map((opt) => renderCard(opt, tone, setTone))}
          </View>

          {/* Initiative */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Initiative</Text>
            {INITIATIVE_OPTIONS.map((opt) => renderCard(opt, initiative, setInitiative))}
          </View>
        </ScrollView>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
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

  backButton: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backText: {
    color: colors.primaryGold,
    fontSize: 16,
    fontWeight: '400',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  headlines: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  headline: {
    fontSize: 44,
    fontWeight: '300',
    fontStyle: 'italic',
    color: colors.primaryTextGold,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  section: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
    marginBottom: spacing.xs,
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
  cardTextGroup: {
    flex: 1,
  },
  cardTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.primaryTextGold,
  },
  cardDescription: {
    color: colors.outline,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  continueButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  continueButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
