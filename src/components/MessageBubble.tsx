import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Image,
  Clipboard,
  Alert,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { spacing, getThemeColors } from '../theme';
import { Message, ConnectionStatus } from '../types';
import { MessageContent } from './MessageContent';
import { StreamingCursor } from './StreamingCursor';

const owlLogo = require('../../assets/owl-logo.png');

// ─── Time helper ──────────────────────────────────────────────────────────────

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

export function StatusDot({ status }: { status: ConnectionStatus }) {
  const { colors } = useTheme();

  const dotColor =
    status === 'connected' ? colors.success :
    status === 'connecting' ? colors.primaryGold :
    colors.error;

  const label =
    status === 'connected' ? 'Connected' :
    status === 'connecting' ? 'Connecting...' :
    'Disconnected';

  const styles = useMemo(() => createStatusDotStyles(colors), [colors]);

  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

export const MessageBubble = React.memo(function MessageBubble({ message, isStreaming, onRetry }: { message: Message; isStreaming?: boolean; onRetry?: (msg: Message) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBubbleStyles(colors), [colors]);
  const isUser = message.sender === 'user';
  const isFailed = message.status === 'failed';

  if (isUser) {
    return (
      <View style={styles.bubbleRowUser}>
        <View style={[styles.bubbleUser, isFailed && { opacity: 0.6 }]}>
          {message.imageUri && (
            <Image
              source={{ uri: message.imageUri }}
              style={styles.inlineImage}
              resizeMode="cover"
            />
          )}
          <MessageContent text={message.text} isUser />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            {isFailed && onRetry && (
              <TouchableOpacity onPress={() => onRetry(message)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: '#ff6b6b', fontSize: 12, fontWeight: '600' }}>⚠️ Tap to retry</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.timeTextUser}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      </View>
    );
  }

  const handleLongPress = () => {
    Clipboard.setString(message.text);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  return (
    <TouchableWithoutFeedback onLongPress={handleLongPress}>
      <View style={styles.bubbleRowWakeel}>
        <View style={styles.wakeelAvatarRow}>
          <View style={styles.wakeelAvatar}>
            <Image source={owlLogo} style={styles.wakeelAvatarImg} />
          </View>
          <Text style={styles.wakeelLabel}>Wakeel</Text>
        </View>
        <View style={styles.wakeelMessageBody}>
          <MessageContent text={message.text} isUser={false} isStreaming={isStreaming} />
          {isStreaming && <StreamingCursor />}
        </View>
        <Text style={styles.timeTextWakeel}>{formatTime(message.timestamp)}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}, (prev, next) => {
  return prev.message.id === next.message.id
    && prev.message.text === next.message.text
    && prev.message.imageUri === next.message.imageUri
    && prev.message.status === next.message.status
    && prev.isStreaming === next.isStreaming;
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStatusDotStyles = (colors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: colors.outline,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

const createBubbleStyles = (colors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
  bubbleRowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.lg,
    paddingLeft: 60,
  },
  bubbleUser: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxWidth: '85%',
  },
  inlineImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  timeTextUser: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 4,
    alignSelf: 'flex-end',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bubbleRowWakeel: {
    marginBottom: spacing.xl,
    paddingRight: 60,
  },
  wakeelAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  wakeelAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#C9A84C',
    overflow: 'hidden',
  },
  wakeelAvatarImg: {
    width: '100%' as any,
    height: '100%' as any,
  },
  wakeelLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryTextGold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  wakeelMessageBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    paddingLeft: 2,
  },
  timeTextWakeel: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingLeft: 2,
  },
});
