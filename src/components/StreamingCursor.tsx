import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../theme';

/**
 * Blinking cursor shown at the end of a streaming AI message.
 */
export function StreamingCursor() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.Text style={[styles.cursor, { opacity }]}>|</Animated.Text>
  );
}

const createStyles = (colors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
  cursor: {
    color: colors.primaryTextGold,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '300',
  },
});
