import React, { useEffect, useState } from 'react';
import { StatusBar, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import './src/notificationCapture'; // Module-level setup — must import before components
import { PairingScreen } from './src/screens/PairingScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { WelcomeScreen } from './src/screens/onboarding/WelcomeScreen';
import { NameWakeelScreen } from './src/screens/onboarding/NameWakeelScreen';
import { AboutYouScreen } from './src/screens/onboarding/AboutYouScreen';
import { PeopleScreen } from './src/screens/onboarding/PeopleScreen';
import { PersonalityScreen } from './src/screens/onboarding/PersonalityScreen';
import { ProvisioningScreen } from './src/screens/onboarding/ProvisioningScreen';
import { ReadyScreen } from './src/screens/onboarding/ReadyScreen';
import { PermissionsScreen } from './src/screens/onboarding/PermissionsScreen';
import { WhatCanWakeelDoScreen } from './src/screens/WhatCanWakeelDoScreen';
import { ThemeProvider } from './src/ThemeContext';
import { getPairing, savePairing } from './src/storage';
import { getAccountToken, clearAccountToken, fetchAccountAndPairing, saveAccountInfo } from './src/auth';
import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── OTA Update Checker (disabled — expo-updates off in this build) ─────────
async function checkForOTAUpdate() {
  // expo-updates disabled to break error recovery crash loop
  // Will re-enable once device Keychain state is cleared
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  // Check for OTA updates on every app launch
  useEffect(() => { checkForOTAUpdate(); }, []);

  useEffect(() => {
    (async () => {
      const pairing = await getPairing();
      if (pairing) {
        // Has pairing (legacy users + post-auth) — go straight to Chat
        setInitialRoute('Chat');
        return;
      }

      const accountToken = await getAccountToken();
      if (accountToken) {
        // Has account token — check server for existing pairing
        try {
          const { pairing: serverPairing, account } = await fetchAccountAndPairing(accountToken);
          if (serverPairing) {
            await savePairing(serverPairing);
            await saveAccountInfo(account);
            setInitialRoute('Chat');
          } else {
            // Logged in but Wakeel not provisioned yet
            setInitialRoute('OnboardingName');
          }
        } catch {
          // Token invalid or server error — clear and go to auth
          await clearAccountToken();
          setInitialRoute('Auth');
        }
        return;
      }

      // No pairing, no account token — fresh user
      setInitialRoute('Auth');
    })();
  }, []);

  if (!initialRoute) return null;

  return (
    <ThemeProvider>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#050505' },
          }}
        >
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="OnboardingName" component={NameWakeelScreen} />
          <Stack.Screen name="OnboardingAbout" component={AboutYouScreen} />
          <Stack.Screen name="OnboardingPeople" component={PeopleScreen} />
          <Stack.Screen name="OnboardingPermissions" component={PermissionsScreen} />
          <Stack.Screen name="OnboardingPersonality" component={PersonalityScreen} />
          <Stack.Screen name="OnboardingProvisioning" component={ProvisioningScreen} />
          <Stack.Screen
            name="WhatCanWakeelDo"
            component={WhatCanWakeelDoScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="OnboardingReady" component={ReadyScreen} />
          <Stack.Screen name="Pairing" component={PairingScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
