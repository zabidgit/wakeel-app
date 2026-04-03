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
import { colors, spacing } from '../../theme';
import { RootStackParamList } from '../../types';

import { RouteProp } from '@react-navigation/native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingName'>;
  route: RouteProp<RootStackParamList, 'OnboardingName'>;
};

const SUGGESTIONS = ['Nova', 'Atlas', 'Sage', 'Aria', 'Echo', 'Kai'];

export function NameWakeelScreen({ navigation, route }: Props) {
  const [name, setName] = useState('');
  const accountToken = route?.params?.accountToken;
  const account = route?.params?.account;

  const canContinue = name.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.nebulaTopLeft} />
      <View style={styles.nebulaBottomRight} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Back button */}
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
            {/* Headlines */}
            <View style={styles.headlines}>
              <Text style={styles.headline}>Name your Wakeel</Text>
              <Text style={styles.subtitle}>This is your personal AI assistant.</Text>
            </View>

            {/* Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Give them a name..."
                  placeholderTextColor={colors.outline}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
            </View>

            {/* Suggestion chips */}
            <View style={styles.chipsSection}>
              <Text style={styles.chipsLabel}>Suggestions</Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map((suggestion) => {
                  const isSelected = name === suggestion;
                  return (
                    <TouchableOpacity
                      key={suggestion}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setName(suggestion)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Continue button */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
              onPress={() => {
                if (canContinue) {
                  navigation.navigate('OnboardingAbout', { wakeclName: name.trim(), accountToken, account });
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
    fontSize: 18,
    letterSpacing: 0.5,
  },

  chipsSection: {
    marginBottom: spacing.lg,
  },
  chipsLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.outline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginLeft: spacing.md,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  chipSelected: {
    borderColor: colors.primaryGold,
    backgroundColor: colors.primaryGold + '15',
  },
  chipText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  chipTextSelected: {
    color: colors.primaryGold,
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
