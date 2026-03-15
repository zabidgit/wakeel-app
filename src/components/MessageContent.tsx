import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors } from '../theme';

interface MessageContentProps {
  text: string;
  isUser: boolean;
}

const userMarkdownStyles = StyleSheet.create({
  body: { color: colors.black, fontSize: 15, lineHeight: 21 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  link: { color: colors.darkGray, textDecorationLine: 'underline' as const },
  code_inline: { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, paddingHorizontal: 4, fontFamily: 'Courier', fontSize: 13 },
  fence: { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 8, padding: 10, fontFamily: 'Courier', fontSize: 13, color: colors.black },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  paragraph: { marginVertical: 2 },
  heading1: { fontSize: 18, fontWeight: '700' as const, marginVertical: 4 },
  heading2: { fontSize: 16, fontWeight: '700' as const, marginVertical: 4 },
  heading3: { fontSize: 15, fontWeight: '600' as const, marginVertical: 3 },
});

const wakeelMarkdownStyles = StyleSheet.create({
  body: { color: colors.cream, fontSize: 15, lineHeight: 21 },
  strong: { fontWeight: '700', color: colors.gold },
  em: { fontStyle: 'italic' },
  link: { color: colors.goldLight, textDecorationLine: 'underline' as const },
  code_inline: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, paddingHorizontal: 4, fontFamily: 'Courier', fontSize: 13, color: colors.goldLight },
  fence: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, fontFamily: 'Courier', fontSize: 13, color: colors.cream },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  paragraph: { marginVertical: 2 },
  heading1: { fontSize: 18, fontWeight: '700' as const, color: colors.gold, marginVertical: 4 },
  heading2: { fontSize: 16, fontWeight: '700' as const, color: colors.gold, marginVertical: 4 },
  heading3: { fontSize: 15, fontWeight: '600' as const, color: colors.goldLight, marginVertical: 3 },
});

export function MessageContent({ text, isUser }: MessageContentProps) {
  // Simple messages without markdown — render as plain text for performance
  const hasMarkdown = /[*_`#\[\]>-]/.test(text);

  if (!hasMarkdown) {
    return (
      <Text style={isUser ? userMarkdownStyles.body : wakeelMarkdownStyles.body}>
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
