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
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnboardingPeople'>;
  route: RouteProp<RootStackParamList, 'OnboardingPeople'>;
};

export function PeopleScreen({ navigation, route }: Props) {
  const { wakeclName, userName, userNickname, userTimezone, accountToken, account } = route.params;
  const [partnerName, setPartnerName] = useState('');
  const [familyMembers, setFamilyMembers] = useState<string[]>([]);

  const addPerson = () => {
    setFamilyMembers([...familyMembers, '']);
  };

  const updatePerson = (index: number, value: string) => {
    const updated = [...familyMembers];
    updated[index] = value;
    setFamilyMembers(updated);
  };

  const removePerson = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    const filledMembers = familyMembers.filter((m) => m.trim().length > 0);
    navigation.navigate('OnboardingPersonality', {
      wakeclName,
      userName,
      userNickname,
      userTimezone,
      partnerName: partnerName.trim() || undefined,
      familyMembers: filledMembers.length > 0 ? filledMembers : undefined,
      accountToken,
      account,
    });
  };

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
              <Text style={styles.headline}>Your people</Text>
              <Text style={styles.subtitle}>Who matters most? (optional)</Text>
            </View>

            {/* Partner */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Partner / Spouse Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={partnerName}
                  onChangeText={setPartnerName}
                  placeholder="Their name"
                  placeholderTextColor={colors.outline}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Family & friends */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Family & Friends</Text>

              {familyMembers.map((member, index) => (
                <View key={index} style={styles.memberRow}>
                  <View style={[styles.inputWrapper, styles.memberInput]}>
                    <TextInput
                      style={styles.input}
                      value={member}
                      onChangeText={(val) => updatePerson(index, val)}
                      placeholder="Name"
                      placeholderTextColor={colors.outline}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePerson(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addButton}
                onPress={addPerson}
                activeOpacity={0.7}
              >
                <Text style={styles.addButtonText}>+ Add person</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleContinue}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
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

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  memberInput: {
    flex: 1,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.outline,
    fontSize: 14,
  },

  addButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonText: {
    color: colors.primaryGold,
    fontSize: 13,
    letterSpacing: 1,
  },

  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    color: colors.outline,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
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
