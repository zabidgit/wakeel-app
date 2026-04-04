import React, { useMemo, useState } from 'react';
import { Text, StyleSheet, Image, View, Dimensions, TouchableOpacity, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../ThemeContext';
import { getThemeColors } from '../theme';

const IMAGE_URL_REGEX = /https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?/gi;
const MAX_IMAGE_WIDTH = Dimensions.get('window').width * 0.65;

interface MessageContentProps {
  text: string;
  isUser: boolean;
  isStreaming?: boolean;
}

function InlineImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(url)}>
        <Text style={{ color: '#6b9eff', fontSize: 13, textDecorationLine: 'underline', marginVertical: 4 }}>🖼️ View image</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)} style={{ marginVertical: 6 }}>
      <Image
        source={{ uri: url }}
        style={{ width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_WIDTH * 0.66, borderRadius: 10 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </TouchableOpacity>
  );
}

export function MessageContent({ text, isUser, isStreaming }: MessageContentProps) {
  const { colors } = useTheme();
  const { userMarkdownStyles, wakeelMarkdownStyles } = useMemo(() => createMarkdownStyles(colors), [colors]);

  // During streaming, render as plain text to prevent jagged markdown re-renders
  if (isStreaming) {
    return (
      <Text style={isUser ? userMarkdownStyles.body : wakeelMarkdownStyles.body}>
        {text}
      </Text>
    );
  }

  // Extract image URLs from wakeel messages and render inline
  const imageUrls = !isUser ? (text.match(IMAGE_URL_REGEX) || []) : [];
  const textWithoutImages = imageUrls.length > 0
    ? imageUrls.reduce((t, url) => t.replace(url, '').trim(), text)
    : text;

  const hasMarkdown = /[*_`#\[\]>-]/.test(textWithoutImages);

  const textContent = !textWithoutImages ? null : hasMarkdown ? (
    <Markdown style={isUser ? userMarkdownStyles : wakeelMarkdownStyles}>
      {textWithoutImages}
    </Markdown>
  ) : (
    <Text style={isUser ? userMarkdownStyles.body : wakeelMarkdownStyles.body}>
      {textWithoutImages}
    </Text>
  );

  if (imageUrls.length === 0) {
    return textContent;
  }

  return (
    <View>
      {textContent}
      {imageUrls.map((url, i) => (
        <InlineImage key={`${url}-${i}`} url={url} />
      ))}
    </View>
  );
}

const createMarkdownStyles = (colors: ReturnType<typeof getThemeColors>) => {
  const userMarkdownStyles = StyleSheet.create({
    body: { color: colors.onSurface, fontSize: 15, lineHeight: 22 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    link: { color: colors.primaryGold, textDecorationLine: 'underline' as const },
    code_inline: {
      backgroundColor: 'rgba(128,128,128,0.12)',
      borderRadius: 3,
      paddingHorizontal: 4,
      fontFamily: 'Courier',
      fontSize: 13,
    },
    fence: {
      backgroundColor: 'rgba(128,128,128,0.08)',
      borderRadius: 8,
      padding: 10,
      fontFamily: 'Courier',
      fontSize: 13,
      color: colors.onSurface,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    paragraph: { marginVertical: 2 },
    heading1: { fontSize: 18, fontWeight: '700' as const, marginVertical: 4 },
    heading2: { fontSize: 16, fontWeight: '700' as const, marginVertical: 4 },
    heading3: { fontSize: 15, fontWeight: '600' as const, marginVertical: 3 },
  });

  const wakeelMarkdownStyles = StyleSheet.create({
    body: { color: colors.onSurface, fontSize: 15, lineHeight: 22, fontWeight: '300' },
    strong: { fontWeight: '600', color: colors.primaryTextGold },
    em: { fontStyle: 'italic', color: colors.secondary },
    link: { color: colors.primaryTextGold, textDecorationLine: 'underline' as const },
    code_inline: {
      backgroundColor: 'rgba(128,128,128,0.10)',
      borderRadius: 3,
      paddingHorizontal: 4,
      fontFamily: 'Courier',
      fontSize: 13,
      color: colors.primaryTextGold,
    },
    fence: {
      backgroundColor: 'rgba(128,128,128,0.06)',
      borderRadius: 8,
      padding: 10,
      fontFamily: 'Courier',
      fontSize: 13,
      color: colors.onSurface,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    paragraph: { marginVertical: 2 },
    heading1: { fontSize: 20, fontWeight: '300' as const, color: colors.primaryTextGold, fontStyle: 'italic', marginVertical: 4 },
    heading2: { fontSize: 17, fontWeight: '300' as const, color: colors.primaryTextGold, marginVertical: 4 },
    heading3: { fontSize: 15, fontWeight: '400' as const, color: colors.onSurfaceVariant, marginVertical: 3 },
  });

  return { userMarkdownStyles, wakeelMarkdownStyles };
};
