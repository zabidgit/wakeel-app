import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { ChatInfo } from '../types';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.75;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  chats: ChatInfo[];
  activeChatId: string;
  onSelectChat: (chat: ChatInfo) => void;
  onNewChat: () => void;
  onDeleteChat: (chat: ChatInfo) => void;
  onRenameChat: (chat: ChatInfo) => void;
  onSettings: () => void;
}

export function Sidebar({
  visible,
  onClose,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onSettings,
}: SidebarProps) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleLongPress = (chat: ChatInfo) => {
    if (chat.sessionKey === 'main') {
      // Can't delete/rename General
      return;
    }
    Alert.alert(
      chat.name,
      'What would you like to do?',
      [
        { text: 'Rename', onPress: () => onRenameChat(chat) },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteChat(chat) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Sidebar panel */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            width: SIDEBAR_WIDTH,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Chats</Text>
          <TouchableOpacity onPress={onNewChat} activeOpacity={0.7} style={styles.newChatButton}>
            <Text style={styles.newChatText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Chat list */}
        <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <TouchableOpacity
                key={chat.id}
                style={[styles.chatItem, isActive && styles.chatItemActive]}
                onPress={() => onSelectChat(chat)}
                onLongPress={() => handleLongPress(chat)}
                activeOpacity={0.7}
              >
                <Text style={styles.chatEmoji}>{chat.emoji}</Text>
                <Text
                  style={[styles.chatName, isActive && styles.chatNameActive]}
                  numberOfLines={1}
                >
                  {chat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Settings at bottom */}
        <View style={styles.sidebarFooter}>
          <View style={styles.footerDivider} />
          <TouchableOpacity
            style={styles.settingsItem}
            onPress={onSettings}
            activeOpacity={0.7}
          >
            <Text style={styles.chatEmoji}>⚙</Text>
            <Text style={styles.chatName}>Settings</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.primaryTextGold,
    letterSpacing: 1,
  },
  newChatButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryGold,
  },
  newChatText: {
    color: colors.primaryGold,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: 2,
    gap: 12,
  },
  chatItemActive: {
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  chatEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '300',
    color: colors.onSurface,
    letterSpacing: 0.3,
  },
  chatNameActive: {
    color: colors.primaryTextGold,
    fontWeight: '400',
  },
  sidebarFooter: {
    marginTop: spacing.sm,
  },
  footerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginBottom: spacing.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    gap: 12,
  },
});
