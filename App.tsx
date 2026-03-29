import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { ThemeProvider } from './src/ThemeContext';
import { getPairing, savePairing } from './src/storage';
import { getAccountToken, clearAccountToken, fetchAccountAndPairing, saveAccountInfo } from './src/auth';
import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

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
          <Stack.Screen name="OnboardingPersonality" component={PersonalityScreen} />
          <Stack.Screen name="OnboardingProvisioning" component={ProvisioningScreen} />
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
