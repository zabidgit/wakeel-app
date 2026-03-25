import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors } from '../theme';

interface MessageContentProps {
  text: string;
  isUser: boolean;
}

const userMarkdownStyles = StyleSheet.create({
  body: { color: colors.onSurface, fontSize: 15, lineHeight: 22 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  link: { color: colors.primaryGold, textDecorationLine: 'underline' as const },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    paddingHorizontal: 4,
    fontFamily: 'Courier',
    fontSize: 13,
  },
  fence: {
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    paddingHorizontal: 4,
    fontFamily: 'Courier',
    fontSize: 13,
    color: colors.primaryTextGold,
  },
  fence: {
    backgroundColor: 'rgba(255,255,255,0.05)',
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

export function MessageContent({ text, isUser }: MessageContentProps) {
  const hasMarkdown = /[*_`#\[\]>-]/.test(text);

  if (!hasMarkdown) {
    return (
      <Text selectable style={isUser ? userMarkdownStyles.body : wakeelMarkdownStyles.body}>
        {text}
      </Text>
    );
  }

  return (
    <Markdown style={isUser ? userMarkdownStyles : wakeelMarkdownStyles}>
      {text}
    </Markdown>
  );
}
