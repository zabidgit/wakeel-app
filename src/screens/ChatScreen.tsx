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
import { colors, spacing } from '../theme';
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
import { useWebSocket, Attachment } from '../useWebSocket';
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

// Delivery queue re-sends arrive with a new random ID but identical content.
// Guard against this: if Wakeel already sent this exact text within the last hour, it's a re-delivery.
const CONTENT_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Repair timestamps from message IDs.
// Message IDs contain the original Date.now() at creation: "user-1775082043000-0.xyz" or "wakeel-1775082043000-0.xyz".
// A previous OTA stored Wakeel messages with server timestamps (different clock) which broke ordering.
// This extracts the reliable receipt-time timestamp from the ID to repair corrupted entries.
function repairTimestamp(msg: Message): Message {
  const match = msg.id.match(/^(?:user|wakeel)-(\d{13,})-/);
  if (match) {
    const idTs = parseInt(match[1], 10);
    if (!isNaN(idTs) && idTs > 1700000000000 && idTs < 1900000000000) {
      if (msg.timestamp !== idTs) {
        return { ...msg, timestamp: idTs };
      }
    }
  }
  return msg;
}

function insertSorted(arr: Message[], msg: Message): Message[] {
  // Content dedup: same Wakeel text within 1 hour = delivery queue re-send, not a new message
  if (msg.sender === 'wakeel' && arr.some(m =>
    m.sender === 'wakeel' &&
    m.text === msg.text &&
    Math.abs(m.timestamp - msg.timestamp) < CONTENT_DEDUP_WINDOW_MS
  )) {
    return arr;
  }
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
  // Step 0: Repair any timestamps corrupted by server-time storage
  const repaired = msgs.map(repairTimestamp);
  // Step 1: deduplicate by ID (original behaviour)
  const seen = new Map<string, Message>();
  for (const m of repaired) {
    seen.set(m.id, m);
  }
  // Step 2: deduplicate Wakeel messages by content within a 1-hour window.
  // Delivery queue re-sends produce a new random ID but identical text — this catches those.
  // Sort first so we always keep the earliest (original) copy.
  const sorted = Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
  const result: Message[] = [];
  for (const m of sorted) {
    if (m.sender === 'wakeel') {
      const isDupe = result.some(r =>
        r.sender === 'wakeel' &&
        r.text === m.text &&
        Math.abs(r.timestamp - m.timestamp) < CONTENT_DEDUP_WINDOW_MS
      );
      if (!isDupe) result.push(m);
    } else {
      result.push(m);
    }
  }
  return result;
}

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
      <Text style={[styles.statusText, { opacity: 0.4, fontSize: 9, marginLeft: 4 }]}>v6</Text>
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [wakeelName, setWakeelName] = useState('Wakeel');
  const [pairingData, setPairingData] = useState<{ url: string; token: string } | null>(null);
  const pairingDataRef = useRef<{ url: string; token: string } | null>(null);
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
  // Track latest stored message timestamp to filter out history replays on reconnect
  const maxStoredTsRef = useRef<number>(0);
  // Guards against delivery-queue messages saving to storage before history has loaded.
  // Without this, a fast delivery-queue fire can overwrite the full message history
  // with just the one queued message before AsyncStorage finishes reading.
  const storageLoadedRef = useRef<boolean>(false);
  const { status, send, sendPushToken, connect, onMessage } = useWebSocket();
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
      const pd = { url: pairing.url, token: pairing.token };
      pairingDataRef.current = pd;
      setPairingData(pd);
      connect(pairing);

      // Load chats
      const savedChats = await getChats();
      setChats(savedChats);

      // Set active chat (default to first = General)
      const firstChat = savedChats[0];
      setActiveChat(firstChat);
      activeChatRef.current = firstChat;

      // Load messages for active chat.
      // IMPORTANT: use a functional setMessages so we can merge with any messages that
      // arrived via the delivery queue before AsyncStorage finished reading.  Without this
      // merge the delivery-queue message saves [just_one_msg] to storage, overwriting the
      // full history.  We also persist the merged result immediately so storage is repaired.
      const saved = await getChatMessages(firstChat.sessionKey);
      const rawSaved = saved.length > 0 ? saved : await getMessages(); // fallback: legacy key
      const sortedFromStorage = dedupeAndSort(rawSaved);
      setMessages(prev => {
        const merged = dedupeAndSort([...sortedFromStorage, ...prev]);
        if (merged.length > 0) {
          saveChatMessages(firstChat.sessionKey, merged); // repair storage immediately
        }
        // Mark storage as loaded — onMessage saves are now safe
        storageLoadedRef.current = true;
        if (merged.length > 0) {
          maxStoredTsRef.current = Math.max(
            ...merged.map(m => m.timestamp),
            maxStoredTsRef.current,
          );
        }
        return merged;
      });
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
          registerTokenWithPushServer(token, undefined, pairingDataRef.current?.token);
        }
      });
    }
    if (status === 'disconnected') {
      pushTokenSent.current = false;
    }
  }, [status, sendPushToken]);

  // Handle incoming messages
  useEffect(() => {
    onMessage((text: string, isFinal: boolean, serverId?: string, serverTs?: number) => {
      if (isFinal) {
        // Always use phone receipt time — server timestamps use a different clock which
        // causes messages to sort out of conversation order (clock skew).
        // Delivery-queue duplicates are caught by content dedup in insertSorted instead.
        const msgTs = Date.now();

        setIsTyping(false);
        setStreamingMessage(null);
        const streamId = streamingMsgId.current;
        streamingMsgId.current = null;

        const finalMsg: Message = {
          // Use server-provided ID so any remaining replays get deduped
          id: serverId || `wakeel-${Date.now()}-${Math.random()}`,
          text,
          sender: 'wakeel',
          timestamp: msgTs,
        };

        // Update our replay filter threshold
        if (msgTs > maxStoredTsRef.current) {
          maxStoredTsRef.current = msgTs;
        }

        setMessages(prev => {
          let base = streamId ? prev.filter(m => m.id !== streamId) : prev;
          const updated = insertSorted(base, finalMsg);
          // Only persist once storage has fully loaded — writing before load completes
          // overwrites the full history with just this one message (race condition).
          if (storageLoadedRef.current) {
            const currentChat = activeChatRef.current;
            if (currentChat) {
              saveChatMessages(currentChat.sessionKey, updated);
            } else {
              saveMessages(updated);
            }
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

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0 || streamingMessage) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, streamingMessage]);

  // ─── Reload messages when returning from Settings (e.g. after clear chat) ──
  useFocusEffect(
    React.useCallback(() => {
      const reload = async () => {
        if (!activeChat) return;
        const chatMsgs = await getChatMessages(activeChat.sessionKey);
        if (chatMsgs.length > 0) {
          const sorted = dedupeAndSort(chatMsgs);
          setMessages(sorted);
          // Persist repaired timestamps so they survive future restarts
          await saveChatMessages(activeChat.sessionKey, sorted);
          maxStoredTsRef.current = Math.max(...sorted.map(m => m.timestamp));
        } else {
          setMessages([]);
          maxStoredTsRef.current = 0;
        }
      };
      reload();
    }, [activeChat?.sessionKey])
  );

  // ─── Chat switching ───────────────────────────────────────────────────────

  const switchChat = useCallback(async (chat: ChatInfo) => {
    // Save current messages first
    if (activeChat) {
      await saveChatMessages(activeChat.sessionKey, messages);
    }

    setActiveChat(chat);
    activeChatRef.current = chat;
    setSidebarVisible(false);

    // Clear streaming state
    setStreamingMessage(null);
    streamingMsgId.current = null;
    setIsTyping(false);

    // Load new chat's messages (simple replace — no delivery queue race here)
    storageLoadedRef.current = false;
    const chatMsgs = await getChatMessages(chat.sessionKey);
    if (chatMsgs.length > 0) {
      const sorted = dedupeAndSort(chatMsgs);
      setMessages(sorted);
      maxStoredTsRef.current = Math.max(...sorted.map(m => m.timestamp));
    } else {
      setMessages([]);
      maxStoredTsRef.current = 0;
    }
    storageLoadedRef.current = true;
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
            // Pick a random emoji from the list
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
    if (chat.sessionKey === 'main') return; // Can't delete General

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

            // If deleting the active chat, switch to General
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

    // Use active chat's sessionKey for sending
    const sessionKey = activeChat?.sessionKey || 'main';

    if (attachment) {
      // Upload to provisioning server (app.getwakeel.app/upload), auth with client gateway token
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
