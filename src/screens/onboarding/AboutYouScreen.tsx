import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { RootStackParamList } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingAbout'>;
  route: RouteProp<RootStackParamList, 'OnboardingAbout'>;
};

export function AboutYouScreen({ navigation, route }: Props) {
  const { wakeclName, accountToken } = route.params;
  const [userName, setUserName] = useState('');
  const [nickname, setNickname] = useState('');
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const canContinue = userName.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headlines}>
              <Text style={styles.headline}>About you</Text>
              <Text style={styles.subtitle}>Let your Wakeel know who you are.</Text>
            </View>

            {/* Your name */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Your name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.outline}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Nickname */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>What should {wakeclName} call you?</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder={userName.trim() || 'Boss, Bro, your name...'}
                  placeholderTextColor={colors.outline}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Timezone */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Timezone</Text>
              <View style={styles.timezoneBadge}>
                <Text style={styles.timezoneText}>
                  🌍  {detectedTimezone} — detected automatically
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
              onPress={() => {
                if (canContinue) {
                  navigation.navigate('OnboardingPeople', {
                    wakeclName,
                    userName: userName.trim(),
                    userNickname: nickname.trim() || userName.trim(),
                    userTimezone: detectedTimezone,
                    accountToken,
                  });
                }
              }}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
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
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
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

  inputSection: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 16,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    fontSize: 16,
    letterSpacing: 0.5,
  },

  timezoneBadge: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    alignSelf: 'flex-start',
  },
  timezoneText: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
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
  continueButtonDisabled: {
    opacity: 0.35,
  },
  continueButtonText: {
    color: colors.surfaceContainerLowest,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
