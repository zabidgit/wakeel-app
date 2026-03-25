import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';

interface OwlLogoProps {
  size?: number;
  showTitle?: boolean;
  showTagline?: boolean;
  showGlow?: boolean;
}

export function OwlLogo({
  size = 160,
  showTitle = true,
  showTagline = true,
  showGlow = false,
}: OwlLogoProps) {
  return (
    <View style={styles.container}>
      {/* Glow behind logo */}
      {showGlow && (
        <View
          style={[
            styles.glow,
            { width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75 },
          ]}
        />
      )}

      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="owlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#ffe9b0" stopOpacity={1} />
            <Stop offset="100%" stopColor="#f2ca50" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        {/* Owl body */}
        <Ellipse cx="100" cy="140" rx="52" ry="52" fill="none" stroke="url(#owlGrad)" strokeWidth="2.5" />
        {/* Head */}
        <Circle cx="100" cy="80" r="42" fill="none" stroke="url(#owlGrad)" strokeWidth="2.5" />
        {/* Left ear tuft */}
        <Path d="M68 45 L58 18 L78 40" fill="url(#owlGrad)" />
        {/* Right ear tuft */}
        <Path d="M132 45 L142 18 L122 40" fill="url(#owlGrad)" />
        {/* Left eye ring */}
        <Circle cx="82" cy="78" r="14" fill="none" stroke={colors.primaryGold} strokeWidth="2" />
        {/* Left eye pupil */}
        <Circle cx="82" cy="78" r="5.5" fill={colors.primaryGold} />
        {/* Right eye ring */}
        <Circle cx="118" cy="78" r="14" fill="none" stroke={colors.primaryGold} strokeWidth="2" />
        {/* Right eye pupil */}
        <Circle cx="118" cy="78" r="5.5" fill={colors.primaryGold} />
        {/* Beak */}
        <Path d="M95 90 L100 100 L105 90" fill={colors.primaryGold} />
        {/* Wing lines */}
        <Path d="M56 128 Q68 148 58 172" fill="none" stroke="url(#owlGrad)" strokeWidth="1.8" opacity={0.55} />
        <Path d="M144 128 Q132 148 142 172" fill="none" stroke="url(#owlGrad)" strokeWidth="1.8" opacity={0.55} />
        {/* Chest feather lines */}
        <Path d="M84 148 Q100 140 116 148" fill="none" stroke="url(#owlGrad)" strokeWidth="1.2" opacity={0.35} />
        <Path d="M80 158 Q100 150 120 158" fill="none" stroke="url(#owlGrad)" strokeWidth="1.2" opacity={0.25} />
      </Svg>

      {showTitle && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>WAKEEL</Text>
          <Text style={styles.arabic}>وکیل</Text>
        </View>
      )}

      {showTagline && (
        <Text style={styles.tagline}>YOUR PERSONAL AI AGENT</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: colors.primaryGold,
    opacity: 0.08,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '300',
    letterSpacing: 8,
    color: colors.primaryTextGold,
  },
  arabic: {
    fontSize: 22,
    color: colors.primaryTextGold,
    opacity: 0.7,
  },
  tagline: {
    fontSize: 10,
    letterSpacing: 3,
    color: colors.outline,
    marginTop: 6,
    textTransform: 'uppercase',
  },
});
