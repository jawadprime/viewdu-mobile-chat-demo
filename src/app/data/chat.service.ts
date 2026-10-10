/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { Injectable, inject, signal } from '@angular/core';
import {
  ChatClient,
  ChatThreadClient,
  ChatMessageReceivedEvent,
  TypingIndicatorReceivedEvent,
  ReadReceiptReceivedEvent,
} from '@azure/communication-chat';
import {
  AzureCommunicationTokenCredential,
  CommunicationIdentifierKind,
  isCommunicationUserIdentifier,
} from '@azure/communication-common';
import { IChatMessage } from '@viewdu/chat-dto-lib';
import { ChatApiService } from './chat-api.service';
import { SessionService } from './session.service';

const TYPING_INDICATOR_TIMEOUT_MS = 8000;
const LATEST_MESSAGES = 50;

function extractAcsUserId(identifier?: CommunicationIdentifierKind): string {
  return identifier && isCommunicationUserIdentifier(identifier) ? identifier.communicationUserId : 'unknown';
}

// History says "text", live events say "Text".
function isTextMessage(type: string): boolean {
  return type.toLowerCase() === 'text';
}

// One instance per chat, so chats don't share state.
@Injectable()
export class ChatService {
  private readonly chatApi = inject(ChatApiService);
  private readonly sessionService = inject(SessionService);

  private chatClient?: ChatClient;
  private threadClient?: ChatThreadClient;
  private threadId = '';
  private ownAcsUserId = '';
  private readonly typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  readonly messages = signal<IChatMessage[]>([]);
  readonly typingUsers = signal<ReadonlySet<string>>(new Set());
  readonly readMessageIds = signal<ReadonlySet<string>>(new Set());

  async connect(acsUserId: string, endpoint: string, initialToken: string): Promise<void> {
    this.ownAcsUserId = acsUserId;

    const credential = new AzureCommunicationTokenCredential({
      token: initialToken,
      refreshProactively: true,
      tokenRefresher: async () => (await this.chatApi.fetchToken()).token,
    });

    this.chatClient = new ChatClient(endpoint, credential);
    await this.chatClient.startRealtimeNotifications();

    this.chatClient.on('chatMessageReceived', this.handleMessageReceived);
    this.chatClient.on('typingIndicatorReceived', this.handleTypingIndicator);
    this.chatClient.on('readReceiptReceived', this.handleReadReceipt);
  }

  async openThread(threadId: string): Promise<void> {
    if (!this.chatClient) return;
    this.threadId = threadId;
    this.threadClient = this.chatClient.getChatThreadClient(threadId);

    this.addMessages(await this.loadLatestMessages());
    this.markLatestFromOthersAsRead();

    void this.restoreReadReceipts();
  }

  async reloadLatestMessages(): Promise<void> {
    if (!this.threadClient) return;
    try {
      this.addMessages(await this.loadLatestMessages());
      this.markLatestFromOthersAsRead();
    } catch {
      // Best-effort.
    }
  }

  // Skips ids we already have: history and live events can overlap.
  private addMessages(incoming: IChatMessage[]): void {
    this.messages.update((current) => {
      const known = new Set(current.map((message) => message.id));
      const fresh = incoming.filter((message) => !known.has(message.id));
      return fresh.length > 0
        ? [...current, ...fresh].sort((a, b) => a.createdOn.getTime() - b.createdOn.getTime())
        : current;
    });
  }

  // One read receipt covers every earlier message.
  private markLatestFromOthersAsRead(): void {
    const lastFromOthers = [...this.messages()].reverse().find((message) => !message.isOwnMessage);
    if (lastFromOthers) {
      void this.markAsRead(lastFromOthers.id);
    }
  }

  private async loadLatestMessages(): Promise<IChatMessage[]> {
    const pages = this.threadClient!.listMessages({ maxPageSize: LATEST_MESSAGES }).byPage();
    const firstPage = await pages.next();

    // ACS lists the newest first.
    return (firstPage.done ? [] : firstPage.value)
      .filter((message) => isTextMessage(message.type) && message.content?.message)
      .map((message) =>
        this.toChatMessage(
          message.id,
          message.sender,
          message.senderDisplayName,
          message.content!.message!,
          message.createdOn,
        ),
      )
      .reverse();
  }

  // ACS keeps each person's latest read receipt, which is enough to restore "Seen".
  private async restoreReadReceipts(): Promise<void> {
    try {
      for await (const receipt of this.threadClient!.listReadReceipts()) {
        if (extractAcsUserId(receipt.sender) !== this.ownAcsUserId) {
          this.markOwnMessagesReadUpTo(receipt.chatMessageId);
        }
      }
    } catch {
      // Best-effort.
    }
  }

  async sendMessage(content: string): Promise<void> {
    // ACS shows a sender name only if we send one.
    await this.threadClient?.sendMessage({ content }, { senderDisplayName: this.sessionService.displayName() });
  }

  async sendTypingNotification(): Promise<void> {
    await this.threadClient?.sendTypingNotification();
  }

  private async markAsRead(messageId: string): Promise<void> {
    try {
      await this.threadClient?.sendReadReceipt({ chatMessageId: messageId });
    } catch {
      // Best-effort.
    }
  }

  async disconnect(): Promise<void> {
    this.typingTimeouts.forEach(clearTimeout);
    this.typingTimeouts.clear();

    if (!this.chatClient) return;
    this.chatClient.off('chatMessageReceived', this.handleMessageReceived);
    this.chatClient.off('typingIndicatorReceived', this.handleTypingIndicator);
    this.chatClient.off('readReceiptReceived', this.handleReadReceipt);
    await this.chatClient.stopRealtimeNotifications();
  }

  // ACS sends events for every chat the user is in, so ignore the other chats.
  private readonly handleMessageReceived = (event: ChatMessageReceivedEvent): void => {
    if (event.threadId !== this.threadId || !isTextMessage(event.type)) return;

    const chatMessage = this.toChatMessage(
      event.id,
      event.sender,
      event.senderDisplayName,
      event.message,
      event.createdOn,
    );
    this.addMessages([chatMessage]);

    // "Seen" only while the app is on screen.
    if (!chatMessage.isOwnMessage && document.visibilityState === 'visible') {
      void this.markAsRead(event.id);
    }
  };

  private readonly handleTypingIndicator = (event: TypingIndicatorReceivedEvent): void => {
    const acsUserId = extractAcsUserId(event.sender);
    if (event.threadId !== this.threadId || acsUserId === this.ownAcsUserId) return;

    this.typingUsers.update((current) => new Set(current).add(acsUserId));

    clearTimeout(this.typingTimeouts.get(acsUserId));

    this.typingTimeouts.set(
      acsUserId,
      setTimeout(() => {
        this.typingUsers.update((current) => {
          const next = new Set(current);
          next.delete(acsUserId);
          return next;
        });
        this.typingTimeouts.delete(acsUserId);
      }, TYPING_INDICATOR_TIMEOUT_MS),
    );
  };

  private readonly handleReadReceipt = (event: ReadReceiptReceivedEvent): void => {
    if (event.threadId === this.threadId && extractAcsUserId(event.sender) !== this.ownAcsUserId) {
      this.markOwnMessagesReadUpTo(event.chatMessageId);
    }
  };

  private markOwnMessagesReadUpTo(chatMessageId: string): void {
    const messages = this.messages();
    const readUpToIndex = messages.findIndex((message) => message.id === chatMessageId);

    const newlyReadIds =
      readUpToIndex === -1
        ? [chatMessageId]
        : messages
            .slice(0, readUpToIndex + 1)
            .filter((message) => message.isOwnMessage)
            .map((message) => message.id);

    this.readMessageIds.update((current) => {
      const next = new Set(current);
      newlyReadIds.forEach((id) => next.add(id));
      return next;
    });
  }

  private toChatMessage(
    id: string,
    sender: CommunicationIdentifierKind | undefined,
    senderDisplayName: string | undefined,
    content: string,
    createdOn: Date,
  ): IChatMessage {
    const senderAcsUserId = extractAcsUserId(sender);
    return {
      id,
      senderAcsUserId,
      senderDisplayName: senderDisplayName || 'Unknown',
      content,
      createdOn,
      isOwnMessage: senderAcsUserId === this.ownAcsUserId,
    };
  }
}
