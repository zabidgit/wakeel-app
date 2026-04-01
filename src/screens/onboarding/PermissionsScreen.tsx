import React, { useState, useRef } from 'react';
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
import * as Notifications from 'expo-notifications';
import { colors, spacing } from '../../theme';
import { RootStackParamList } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingPermissions'>;
  route: RouteProp<RootStackParamList, 'OnboardingPermissions'>;
};

type PermissionState = 'idle' | 'granted' | 'denied';

interface PermissionCardProps {
  icon: string;
  title: string;
  description: string;
  examples: string[];
  status: PermissionState;
  onGrant: () => void;
}

function PermissionCard({ icon, title, description, examples, status, onGrant }: PermissionCardProps) {
  const isGranted = status === 'granted';
  const isDenied = status === 'denied';

  return (
    <View style={[cardStyles.card, isGranted && cardStyles.cardGranted]}>
      <View style={cardStyles.header}>
        <View style={[cardStyles.iconCircle, isGranted && cardStyles.iconCircleGranted]}>
          <Text style={cardStyles.iconText}>{icon}</Text>
        </View>
        <View style={cardStyles.headerText}>
          <Text style={cardStyles.title}>{title}</Text>
          <Text style={cardStyles.description}>{description}</Text>
        </View>
        {isGranted && (
          <View style={cardStyles.badge}>
            <Text style={cardStyles.badgeText}>✓</Text>
          </View>
        )}
      </View>

      <View style={cardStyles.examples}>
        {examples.map((ex, i) => (
          <View key={i} style={cardStyles.exampleRow}>
            <Text style={cardStyles.exampleDot}>·</Text>
            <Text style={cardStyles.exampleText}>{ex}</Text>
          </View>
        ))}
      </View>

      {!isGranted && (
        <TouchableOpacity
          style={[cardStyles.grantButton, isDenied && cardStyles.grantButtonDenied]}
          onPress={onGrant}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.grantButtonText}>
            {isDenied ? 'Open Settings' : 'Allow Access'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function PermissionsScreen({ navigation, route }: Props) {
  const { wakeclName, userName, userNickname, userTimezone, partnerName, familyMembers, accountToken } =
    route.params;

  const [locationStatus, setLocationStatus] = useState<PermissionState>('idle');
  const [calendarStatus, setCalendarStatus] = useState<PermissionState>('idle');
  const [remindersStatus, setRemindersStatus] = useState<PermissionState>('idle');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Location & Calendar: mark acknowledged here — iOS will prompt natively
  // the first time each feature is used (priming UX pattern)
  const handleLocation = () => {
    setLocationStatus('granted');
  };

  const handleCalendar = () => {
    setCalendarStatus('granted');
  };

  const handleReminders = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setRemindersStatus(status === 'granted' ? 'granted' : 'denied');
    } catch {
      setRemindersStatus('denied');
    }
  };

  const handleContinue = () => {
    navigation.navigate('OnboardingPersonality', {
      wakeclName,
      userName,
      userNickname,
      userTimezone,
      partnerName,
      familyMembers,
      accountToken,
    });
  };

  const allGranted =
    locationStatus === 'granted' && calendarStatus === 'granted' && remindersStatus === 'granted';

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <SafeAreaView style={styles.safeArea}>
        {/* Back */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headline}>Let {wakeclName} in</Text>
            <Text style={styles.subtitle}>
              The more {wakeclName} knows, the more they can do.{'\n'}Grant access to get the most out of your Wakeel.
            </Text>
          </View>

          {/* Permission Cards */}
          <View style={styles.cards}>
            <PermissionCard
              icon="📍"
              title="Location"
              description="Know where you are so they can help."
              examples={[
                'Remind you to grab groceries when you\'re near the store',
                'Know when you\'re heading home so dinner prep can begin',
                'Surface local info that\'s actually relevant',
              ]}
              status={locationStatus}
              onGrant={handleLocation}
            />

            <PermissionCard
              icon="📅"
              title="Calendar"
              description="See your day, manage your time."
              examples={[
                'Give you a morning briefing of your schedule',
                'Add events and block time on your behalf',
                'Remind you of what\'s coming up before you forget',
              ]}
              status={calendarStatus}
              onGrant={handleCalendar}
            />

            <PermissionCard
              icon="🔔"
              title="Reminders & Notifications"
              description="Follow through on everything."
              examples={[
                'Set reminders just by asking — no tapping required',
                'Alert you when something needs your attention',
                'Make sure nothing falls through the cracks',
              ]}
              status={remindersStatus}
              onGrant={handleReminders}
            />
          </View>
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.continueButton, !allGranted && styles.continueButtonPartial]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>
              {allGranted ? 'Continue' : 'Continue →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleContinue} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Card Styles ──────────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.md,
  },
  cardGranted: {
    borderColor: colors.primaryGold,
    backgroundColor: 'rgba(242, 202, 80, 0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  iconCircleGranted: {
    backgroundColor: 'rgba(242, 202, 80, 0.15)',
  },
  iconText: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  badgeText: {
    color: colors.surfaceContainerLowest,
    fontSize: 13,
    fontWeight: '700',
  },
  examples: {
    marginBottom: spacing.md,
    gap: 4,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  exampleDot: {
    color: colors.primaryGold,
    fontSize: 16,
    marginRight: 6,
    lineHeight: 20,
  },
  exampleText: {
    flex: 1,
    fontSize: 13,
    color: colors.outline,
    lineHeight: 20,
  },
  grantButton: {
    backgroundColor: colors.primaryGold,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  grantButtonDenied: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  grantButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
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
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.outline,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headline: {
    fontSize: 36,
    fontWeight: '300',
    fontStyle: 'italic',
    color: colors.primaryTextGold,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  cards: {
    gap: spacing.sm,
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
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
  continueButtonPartial: {
    backgroundColor: colors.surfaceContainerHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    color: colors.outline,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
