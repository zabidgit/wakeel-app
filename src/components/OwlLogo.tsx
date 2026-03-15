import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';

interface OwlLogoProps {
  size?: number;
  showTitle?: boolean;
  showTagline?: boolean;
}

export function OwlLogo({ size = 160, showTitle = true, showTagline = true }: OwlLogoProps) {
  const scale = size / 200;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 200 220">
        <Defs>
          <LinearGradient id="owlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#e8d5b7" stopOpacity={1} />
            <Stop offset="100%" stopColor="#c4a56e" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        {/* Owl body */}
        <Ellipse cx="100" cy="130" rx="60" ry="70" fill="none" stroke="url(#owlGrad)" strokeWidth="3" />
        {/* Head */}
        <Circle cx="100" cy="70" r="45" fill="none" stroke="url(#owlGrad)" strokeWidth="3" />
        {/* Left ear tuft */}
        <Path d="M65 35 L55 10 L75 30" fill="url(#owlGrad)" />
        {/* Right ear tuft */}
        <Path d="M135 35 L145 10 L125 30" fill="url(#owlGrad)" />
        {/* Left eye */}
        <Circle cx="80" cy="68" r="15" fill="none" stroke={colors.gold} strokeWidth="2.5" />
        <Circle cx="80" cy="68" r="6" fill={colors.gold} />
        {/* Right eye */}
        <Circle cx="120" cy="68" r="15" fill="none" stroke={colors.gold} strokeWidth="2.5" />
        <Circle cx="120" cy="68" r="6" fill={colors.gold} />
        {/* Beak */}
        <Path d="M95 82 L100 92 L105 82" fill={colors.gold} />
        {/* Wing lines */}
        <Path d="M55 120 Q70 140 60 170" fill="none" stroke="url(#owlGrad)" strokeWidth="2" opacity={0.6} />
        <Path d="M145 120 Q130 140 140 170" fill="none" stroke="url(#owlGrad)" strokeWidth="2" opacity={0.6} />
      </Svg>

      {showTitle && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>WAKEEL</Text>
          <Text style={styles.arabic}>وکیل</Text>
        </View>
      )}

      {showTagline && (
        <Text style={styles.tagline}>وکیل · YOUR PERSONAL AI AGENT</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 8,
    color: colors.gold,
  },
  arabic: {
    fontSize: 24,
    color: colors.gold,
    opacity: 0.7,
  },
  tagline: {
    fontSize: 10,
    letterSpacing: 4,
    color: colors.textMuted,
    marginTop: 6,
  },
});
