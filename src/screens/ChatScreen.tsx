import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../theme';
import { getPairing, saveMessages, getMessages } from '../storage';
import { useWebSocket } from '../useWebSocket';
import { Message, ConnectionStatus, RootStackParamList } from '../types';
import { MessageContent } from '../components/MessageContent';
import { TypingIndicator } from '../components/TypingIndicator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
};

function StatusDot({ status }: { status: ConnectionStatus }) {
  const dotColor =
    status === 'connected' ? colors.success :
    status === 'connecting' ? colors.warning :
    colors.error;

  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusText}>
        {status === 'connected' ? 'Connected' :
         status === 'connecting' ? 'Connecting...' :
         'Disconnected'}
      </Text>
    </View>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === 'user';

  return (
    <View style={[
      styles.bubbleRow,
      isUser ? styles.bubbleRowUser : styles.bubbleRowWakeel,
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleWakeel,
      ]}>
        <MessageContent text={message.text} isUser={isUser} />
        <Text style={[
          styles.timeText,
          isUser ? styles.timeTextUser : styles.timeTextWakeel,
        ]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

export function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [wakeelName, setWakeelName] = useState('Wakeel');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { status, send, connect, onMessage } = useWebSocket();

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
        // Final message — replace the streaming message
        setIsTyping(false);
        // Capture ref BEFORE setMessages — React 18 batching may defer the updater
        const streamId = streamingMsgId.current;
        streamingMsgId.current = null;
        const finalMsg: Message = {
          id: streamId || `wakeel-${Date.now()}-${Math.random()}`,
          text,
          sender: 'wakeel',
          timestamp: Date.now(),
        };
        setMessages(prev => {
          // Replace streaming placeholder in-place if it exists
          if (streamId) {
            const idx = prev.findIndex(m => m.id === streamId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = finalMsg;
              saveMessages(updated);
              return updated;
            }
          }
          // No streaming message found — just append
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{wakeelName}</Text>
          <StatusDot status={status} />
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsButton}
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
            <Text style={styles.emptyEmoji}>🦉</Text>
            <Text style={styles.emptyText}>
              Say hello to your Wakeel
            </Text>
            <Text style={styles.emptySubtext}>
              I'm here to help — ask me anything
            </Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
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
          activeOpacity={0.7}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.sm,
    backgroundColor: colors.darkGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  settingsIcon: {
    fontSize: 22,
    color: colors.textMuted,
  },
  messageListContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bubbleRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowWakeel: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleWakeel: {
    backgroundColor: colors.darkGray,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: colors.black,
  },
  bubbleTextWakeel: {
    color: colors.cream,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeTextUser: {
    color: 'rgba(26, 26, 26, 0.5)',
  },
  timeTextWakeel: {
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 6,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.sm,
    backgroundColor: colors.darkGray,
    borderTopWidth: 1,
    borderTopColor: colors.mediumGray,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.mediumGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.cream,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  sendIcon: {
    color: colors.black,
    fontSize: 18,
    fontWeight: '700',
  },
});
