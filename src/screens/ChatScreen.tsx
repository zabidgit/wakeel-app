import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { spacing, getThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';
import {
  getPairing,
  saveMessages,
  getMessages,
  getChats,
  saveChats,
  getChatMessages,
  saveChatMessages,
  clearChatMessages,
} from '../storage';
import { useWebSocket, Attachment, HistoryMessage } from '../useWebSocket';
import { Message, ConnectionStatus, ChatInfo, RootStackParamList } from '../types';
import { MessageContent } from '../components/MessageContent';
import { TypingIndicator } from '../components/TypingIndicator';
import { StreamingCursor } from '../components/StreamingCursor';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Sidebar } from '../components/Sidebar';
import { registerForPushNotifications, registerTokenWithPushServer, addNotificationResponseReceivedListener, clearBadge } from '../notifications';
import { pickImage, takePhoto, pickDocument, uploadAttachment, AttachmentResult } from '../attachments';

const owlLogo = require('../../assets/owl-logo.png');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function insertSorted(arr: Message[], msg: Message): Message[] {
  const filtered = arr.filter(m => m.id !== msg.id);
  let lo = 0, hi = filtered.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (filtered[mid].timestamp <= msg.timestamp) lo = mid + 1;
    else hi = mid;
  }
  const result = [...filtered];
  result.splice(lo, 0, msg);
  return result;
}

function dedupeAndSort(msgs: Message[]): Message[] {
  const seen = new Map<string, Message>();
  for (const m of msgs) {
    seen.set(m.id, m);
  }
  return Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ConnectionStatus }) {
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

// ─── Time helper ──────────────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBubbleStyles(colors), [colors]);
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <View style={styles.bubbleRowUser}>
        <View style={styles.bubbleUser}>
          {message.imageUri && (
            <Image
              source={{ uri: message.imageUri }}
              style={styles.inlineImage}
              resizeMode="cover"
            />
          )}
          <MessageContent text={message.text} isUser />
          <Text style={styles.timeTextUser}>{formatTime(message.timestamp)}</Text>
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
          <MessageContent text={message.text} isUser={false} />
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
    && prev.isStreaming === next.isStreaming;
});

// ─── Emoji picker for new chats ───────────────────────────────────────────────

const CHAT_EMOJIS = ['💬', '🏠', '🏥', '💼', '📚', '🎯', '🛒', '✈️', '🎮', '💡', '🔬', '🎨'];

// ─── Chat Screen ──────────────────────────────────────────────────────────────

export function ChatScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [wakeelName, setWakeelName] = useState('Wakeel');
  const [pairingData, setPairingData] = useState<{ url: string; token: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentResult | null>(null);

  // Multi-chat state
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [activeChat, setActiveChat] = useState<ChatInfo | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Streaming message
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const streamingMsgId = useRef<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const pushTokenSent = useRef(false);
  const activeChatRef = useRef<ChatInfo | null>(null);
  const { status, send, sendPushToken, connect, onMessage, onHistory } = useWebSocket();
  const insets = useSafeAreaInsets();

  // Keep ref in sync for use in callbacks
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Load pairing, chats, and messages on mount
  useEffect(() => {
    (async () => {
      const pairing = await getPairing();
      if (!pairing) {
        navigation.reset({ index: 0, routes: [{ name: 'Pairing' }] });
        return;
      }

      setWakeelName(pairing.name || 'Wakeel');
      setPairingData({ url: pairing.url, token: pairing.token });
      connect(pairing);

      // Load chats
      const savedChats = await getChats();
      setChats(savedChats);

      // Set active chat (default to first = General)
      const firstChat = savedChats[0];
      setActiveChat(firstChat);
      activeChatRef.current = firstChat;

      // Load messages for active chat
      const saved = await getChatMessages(firstChat.sessionKey);
      if (saved.length > 0) {
        setMessages(dedupeAndSort(saved));
      } else {
        // Try legacy messages (first time migration)
        const legacy = await getMessages();
        if (legacy.length > 0) {
          setMessages(dedupeAndSort(legacy));
        }
      }
    })();

    clearBadge();

    const sub = addNotificationResponseReceivedListener(() => {
      clearBadge();
      flatListRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  // Register push token once connected
  useEffect(() => {
    if (status === 'connected' && !pushTokenSent.current) {
      pushTokenSent.current = true;
      registerForPushNotifications().then((token) => {
        if (token) {
          sendPushToken(token);
          registerTokenWithPushServer(token);
        }
      });
    }
    if (status === 'disconnected') {
      pushTokenSent.current = false;
    }
  }, [status, sendPushToken]);

  // Handle incoming messages
  useEffect(() => {
    onMessage((text: string, isFinal: boolean) => {
      if (isFinal) {
        setIsTyping(false);
        setStreamingMessage(null);
        const streamId = streamingMsgId.current;
        streamingMsgId.current = null;

        const finalMsg: Message = {
          id: `wakeel-${Date.now()}-${Math.random()}`,
          text,
          sender: 'wakeel',
          timestamp: Date.now(),
        };

        setMessages(prev => {
          let base = streamId ? prev.filter(m => m.id !== streamId) : prev;
          const updated = insertSorted(base, finalMsg);
          // Save to active chat's storage
          const currentChat = activeChatRef.current;
          if (currentChat) {
            saveChatMessages(currentChat.sessionKey, updated);
          } else {
            saveMessages(updated);
          }
          return updated;
        });
      } else {
        setIsTyping(false);
        if (!streamingMsgId.current) {
          streamingMsgId.current = `wakeel-stream-${Date.now()}`;
        }
        setStreamingMessage({
          id: streamingMsgId.current,
          text,
          sender: 'wakeel',
          timestamp: Date.now(),
        });
      }
    });
  }, [onMessage]);

  // Handle history loaded on reconnect
  useEffect(() => {
    onHistory((historyMsgs: HistoryMessage[]) => {
      if (historyMsgs.length === 0) return;

      // Convert history messages to our Message format
      // Use a base timestamp and space messages 1s apart for ordering
      const baseTs = Date.now() - (historyMsgs.length * 1000);
      const historyConverted: Message[] = historyMsgs.map((hm, i) => ({
        id: `history-${hm.role}-${i}-${hm.timestamp || (baseTs + i * 1000)}`,
        text: hm.text,
        sender: hm.role === 'user' ? 'user' as const : 'wakeel' as const,
        timestamp: hm.timestamp || (baseTs + i * 1000),
      }));

      setMessages(prev => {
        // Build a set of existing message texts for dedup
        const existingTexts = new Set(prev.map(m => m.text.trim().slice(0, 100)));

        // Only add history messages not already in local state
        const newFromHistory = historyConverted.filter(hm =>
          !existingTexts.has(hm.text.trim().slice(0, 100))
        );

        if (newFromHistory.length === 0) return prev;

        const merged = dedupeAndSort([...prev, ...newFromHistory]);

        // Persist
        const currentChat = activeChatRef.current;
        if (currentChat) {
          saveChatMessages(currentChat.sessionKey, merged);
        } else {
          saveMessages(merged);
        }

        return merged;
      });
    });
  }, [onHistory]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0 || streamingMessage) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, streamingMessage]);

  // ─── Reload messages when returning from Settings ──
  useFocusEffect(
    React.useCallback(() => {
      const reload = async () => {
        if (!activeChat) return;
        const chatMsgs = await getChatMessages(activeChat.sessionKey);
        setMessages(chatMsgs.length > 0 ? dedupeAndSort(chatMsgs) : []);
      };
      reload();
    }, [activeChat?.sessionKey])
  );

  // ─── Chat switching ───────────────────────────────────────────────────────

  const switchChat = useCallback(async (chat: ChatInfo) => {
    if (activeChat) {
      await saveChatMessages(activeChat.sessionKey, messages);
    }

    setActiveChat(chat);
    activeChatRef.current = chat;
    setSidebarVisible(false);

    setStreamingMessage(null);
    streamingMsgId.current = null;
    setIsTyping(false);

    const chatMsgs = await getChatMessages(chat.sessionKey);
    setMessages(chatMsgs.length > 0 ? dedupeAndSort(chatMsgs) : []);
  }, [activeChat, messages]);

  const handleNewChat = useCallback(() => {
    Alert.prompt(
      'New Chat',
      'Enter a name for this chat:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name?: string) => {
            if (!name?.trim()) return;
            const id = `chat-${Date.now()}`;
            const sessionKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const emoji = CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)];
            const newChat: ChatInfo = {
              id,
              name: name.trim(),
              emoji,
              sessionKey,
              createdAt: Date.now(),
            };
            const updated = [...chats, newChat];
            setChats(updated);
            await saveChats(updated);
            switchChat(newChat);
          },
        },
      ],
      'plain-text',
    );
  }, [chats, switchChat]);

  const handleDeleteChat = useCallback(async (chat: ChatInfo) => {
    if (chat.sessionKey === 'main') return;

    Alert.alert(
      'Delete Chat',
      `Delete "${chat.name}" and all its messages? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = chats.filter(c => c.id !== chat.id);
            setChats(updated);
            await saveChats(updated);
            await clearChatMessages(chat.sessionKey);

            if (activeChat?.id === chat.id) {
              const general = updated.find(c => c.sessionKey === 'main') || updated[0];
              switchChat(general);
            }
          },
        },
      ],
    );
  }, [chats, activeChat, switchChat]);

  const handleRenameChat = useCallback((chat: ChatInfo) => {
    Alert.prompt(
      'Rename Chat',
      `Enter a new name for "${chat.name}":`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: async (name?: string) => {
            if (!name?.trim()) return;
            const updated = chats.map(c =>
              c.id === chat.id ? { ...c, name: name.trim() } : c
            );
            setChats(updated);
            await saveChats(updated);
            if (activeChat?.id === chat.id) {
              setActiveChat({ ...chat, name: name.trim() });
            }
          },
        },
      ],
      'plain-text',
      chat.name,
    );
  }, [chats, activeChat]);

  // ─── Attachment handling ──────────────────────────────────────────────────

  const handleAttachmentPress = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Photo Library', 'Take Photo', 'Document', 'Cancel'],
        cancelButtonIndex: 3,
      },
      async (buttonIndex) => {
        let result: AttachmentResult | null = null;
        if (buttonIndex === 0) result = await pickImage();
        else if (buttonIndex === 1) result = await takePhoto();
        else if (buttonIndex === 2) result = await pickDocument();
        if (result) setPendingAttachment(result);
      }
    );
  }, []);

  // ─── Send ─────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    const attachment = pendingAttachment;

    if (!text && !attachment) return;

    const displayText = attachment
      ? text || `📎 ${attachment.fileName}`
      : text;

    const newMsg: Message = {
      id: `user-${Date.now()}-${Math.random()}`,
      text: displayText,
      sender: 'user',
      timestamp: Date.now(),
      ...(attachment && attachment.mimeType.startsWith('image/') ? { imageUri: attachment.uri } : {}),
    };

    setMessages(prev => {
      const updated = insertSorted(prev, newMsg);
      const currentChat = activeChatRef.current;
      if (currentChat) {
        saveChatMessages(currentChat.sessionKey, updated);
      } else {
        saveMessages(updated);
      }
      return updated;
    });

    setInputText('');
    setPendingAttachment(null);
    setIsTyping(true);

    const sessionKey = activeChat?.sessionKey || 'main';

    if (attachment) {
      const uploaded = pairingData
        ? await uploadAttachment(attachment, 'https://app.getwakeel.app', pairingData.token)
        : null;

      if (uploaded) {
        const mediaTag = `[media attached: ${uploaded.path} (${uploaded.mimeType}) | ${uploaded.path}]`;
        const fullMessage = text ? `${mediaTag}\n${text}` : mediaTag;
        send(fullMessage, undefined, sessionKey);
      } else {
        send(text || `[Failed to upload: ${attachment.fileName}]`, undefined, sessionKey);
      }
    } else {
      send(text, undefined, sessionKey);
    }
  }, [inputText, pendingAttachment, send, activeChat]);

  // Footer
  const listFooter = useMemo(() => {
    return (
      <>
        {streamingMessage && (
          <MessageBubble message={streamingMessage} isStreaming />
        )}
        {isTyping && !streamingMessage && <TypingIndicator />}
      </>
    );
  }, [streamingMessage, isTyping]);

  return (
    <View style={styles.container}>
      {/* Nebula backgrounds */}
      <View style={styles.nebulaTop} />
      <View style={styles.nebulaBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerLeft}>
            {/* Hamburger menu */}
            <TouchableOpacity
              onPress={() => setSidebarVisible(true)}
              style={styles.hamburgerButton}
              activeOpacity={0.7}
            >
              <Text style={styles.hamburgerIcon}>☰</Text>
            </TouchableOpacity>
            <View style={styles.logoMini}>
              <Image source={owlLogo} style={styles.logoMiniImg} />
            </View>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeChat?.name || wakeelName}
              </Text>
              <StatusDot status={status} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsButton}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Connection banner */}
        <View style={styles.bannerContainer}>
          <ConnectionBanner status={status} />
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
          ListFooterComponent={listFooter}
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
          {pendingAttachment && (
            <View style={styles.attachmentPreview}>
              {pendingAttachment.mimeType.startsWith('image/') ? (
                <Image source={{ uri: pendingAttachment.uri }} style={styles.attachmentThumb} />
              ) : (
                <View style={styles.attachmentFileIcon}>
                  <Text style={styles.attachmentFileEmoji}>📄</Text>
                </View>
              )}
              <Text style={styles.attachmentName} numberOfLines={1}>
                {pendingAttachment.fileName}
              </Text>
              <TouchableOpacity
                onPress={() => setPendingAttachment(null)}
                style={styles.attachmentRemove}
              >
                <Text style={styles.attachmentRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              onPress={handleAttachmentPress}
              style={styles.attachButton}
              activeOpacity={0.7}
            >
              <Text style={styles.attachIcon}>+</Text>
            </TouchableOpacity>
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
                (!inputText.trim() && !pendingAttachment) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() && !pendingAttachment}
              activeOpacity={0.75}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar overlay */}
      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        chats={chats}
        activeChatId={activeChat?.id || 'general'}
        onSelectChat={switchChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onSettings={() => {
          setSidebarVisible(false);
          navigation.navigate('Settings');
        }}
      />
    </View>
  );
}

// ─── Style factories ──────────────────────────────────────────────────────────

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

  // Wakeel message
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
});

const createStyles = (colors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  hamburgerButton: {
    padding: 4,
    marginRight: 2,
  },
  hamburgerIcon: {
    fontSize: 20,
    color: colors.outline,
  },
  logoMini: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  logoMiniImg: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  headerTitleGroup: {
    gap: 2,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 2,
    color: colors.primaryTextGold,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  settingsIcon: {
    fontSize: 20,
    color: colors.outline,
  },

  // Connection banner container
  bannerContainer: {
    position: 'relative',
    zIndex: 10,
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
    marginBottom: 6,
  },
  emptySubtext: {
    color: colors.outline,
    fontSize: 12,
    letterSpacing: 1,
  },

  // Attachment preview
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryGold,
  },
  attachmentFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentFileEmoji: {
    fontSize: 20,
  },
  attachmentName: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 13,
  },
  attachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentRemoveText: {
    color: colors.outline,
    fontSize: 12,
    fontWeight: '600',
  },

  // Input bar
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
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
  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  attachIcon: {
    color: colors.outline,
    fontSize: 20,
    fontWeight: '300',
    marginTop: -1,
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
