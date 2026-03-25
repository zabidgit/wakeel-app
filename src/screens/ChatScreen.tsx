import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Clipboard,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../theme';
import { getPairing, saveMessages, getMessages } from '../storage';
import { useWebSocket } from '../useWebSocket';
import { Message, ConnectionStatus, RootStackParamList } from '../types';
import { MessageContent } from '../components/MessageContent';
import { TypingIndicator } from '../components/TypingIndicator';
import { StreamingCursor } from '../components/StreamingCursor';

const owlLogo = require('../../assets/owl-logo.png');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
};

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ConnectionStatus }) {
  const dotColor =
    status === 'connected' ? colors.success :
    status === 'connecting' ? colors.primaryGold :
    colors.error;

  const label =
    status === 'connected' ? 'Connected' :
    status === 'connecting' ? 'Connecting...' :
    'Disconnected';

  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

// ─── Time helper ──────────────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === 'user';
  const isStreaming = message.id.startsWith('wakeel-stream-');

  if (isUser) {
    return (
      <View style={styles.bubbleRowUser}>
        <View style={styles.bubbleUser}>
          <MessageContent text={message.text} isUser />
          <Text style={styles.timeTextUser}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  // Wakeel message — no bubble background, avatar + label
  const handleLongPress = () => {
    Clipboard.setString(message.text);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  return (
    <TouchableWithoutFeedback onLongPress={handleLongPress}>
      <View style={styles.bubbleRowWakeel}>
        {/* Avatar row */}
        <View style={styles.wakeelAvatarRow}>
          <View style={styles.wakeelAvatar}>
            <Image source={owlLogo} style={styles.wakeelAvatarImg} />
          </View>
          <Text style={styles.wakeelLabel}>Wakeel Oracle</Text>
        </View>

        {/* Message text */}
        <View style={styles.wakeelMessageBody}>
          <MessageContent text={message.text} isUser={false} />
          {isStreaming && <StreamingCursor />}
        </View>

        <Text style={styles.timeTextWakeel}>{formatTime(message.timestamp)}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Chat Screen ──────────────────────────────────────────────────────────────

export function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [wakeelName, setWakeelName] = useState('Wakeel');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { status, send, connect, onMessage } = useWebSocket();
  const insets = useSafeAreaInsets();

  // Load pairing and messages on mount
  useEffect(() => {
    (async () => {
      const pairing = await getPairing();
      if (!pairing) {
        navigation.reset({ index: 0, routes: [{ name: 'Pairing' }] });
        return;
      }

      setWakeelName(pairing.name || 'Wakeel');
      connect(pairing);

      const saved = await getMessages();
      if (saved.length > 0) {
        setMessages(saved);
      }
    })();
  }, []);

  // Track the current streaming message ID
  const streamingMsgId = useRef<string | null>(null);

  // Handle incoming messages (streaming deltas + finals)
  useEffect(() => {
    onMessage((text: string, isFinal: boolean) => {
      if (isFinal) {
        // Final message — replace streaming bubble in-place
        setIsTyping(false);
        // Capture ref BEFORE setMessages — React 18 batching may defer the updater
        const streamId = streamingMsgId.current;
        streamingMsgId.current = null;
        const finalMsg: Message = {
          id: `wakeel-${Date.now()}-${Math.random()}`,
          text,
          sender: 'wakeel',
          timestamp: Date.now(),
        };
        setMessages(prev => {
          if (streamId) {
            const idx = prev.findIndex(m => m.id === streamId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = finalMsg;
              saveMessages(updated);
              return updated;
            }
          }
          const updated = [...prev, finalMsg];
          saveMessages(updated);
          return updated;
        });
      } else {
        // Streaming delta — update or create streaming message
        setIsTyping(false);
        if (!streamingMsgId.current) {
          streamingMsgId.current = `wakeel-stream-${Date.now()}`;
        }
        const msgId = streamingMsgId.current;
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === msgId);
          const streamMsg: Message = {
            id: msgId,
            text,
            sender: 'wakeel',
            timestamp: Date.now(),
          };
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = streamMsg;
            return updated;
          } else {
            return [...prev, streamMsg];
          }
        });
      }
    });
  }, [onMessage]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    const newMsg: Message = {
      id: `user-${Date.now()}-${Math.random()}`,
      text,
      sender: 'user',
      timestamp: Date.now(),
    };

    setMessages(prev => {
      const updated = [...prev, newMsg];
      saveMessages(updated);
      return updated;
    });

    send(text);
    setInputText('');
    setIsTyping(true);
  }, [inputText, send]);

  return (
    <View style={styles.container}>
      {/* Subtle nebula backgrounds */}
      <View style={styles.nebulaTop} />
      <View style={styles.nebulaBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {/* Logo + name + status */}
          <View style={styles.headerLeft}>
            <View style={styles.logoMini}>
              <Image source={owlLogo} style={styles.logoMiniImg} />
            </View>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>{wakeelName}</Text>
              <StatusDot status={status} />
            </View>
          </View>

          {/* Settings button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsButton}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.messageList}
          style={styles.messageListContainer}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image source={owlLogo} style={styles.emptyOwl} />
              <Text style={styles.emptyText}>Say hello to your Wakeel</Text>
              <Text style={styles.emptySubtext}>I'm here to help — ask me anything</Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          {/* Subtle gold border glow on the input container */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message Wakeel..."
              placeholderTextColor={colors.outline}
              multiline
              maxLength={4000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.75}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // Nebula glows
  nebulaTop: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primaryGold,
    opacity: 0.04,
  },
  nebulaBottom: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.08,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(5,5,5,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMini: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  logoMiniImg: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  headerTitleGroup: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.primaryTextGold,
  },
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
  settingsButton: {
    padding: spacing.sm,
  },
  settingsIcon: {
    fontSize: 20,
    color: colors.outline,
  },

  // Message list
  messageListContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },

  // User bubble
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
  timeTextUser: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 4,
    alignSelf: 'flex-end',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Wakeel message (no background)
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
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wakeelAvatarImg: {
    width: 22,
    height: 22,
    borderRadius: 4,
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

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyOwl: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
    opacity: 0.5,
    borderRadius: 12,
  },
  emptyText: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: '300',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  emptySubtext: {
    color: colors.outline,
    fontSize: 12,
    letterSpacing: 1,
  },

  // Input bar
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(5,5,5,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: colors.primaryGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceContainerHighest,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    color: colors.surfaceContainerLowest,
    fontSize: 18,
    fontWeight: '700',
  },
});
