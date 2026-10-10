/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { ChatApiService } from '../../data/chat-api.service';
import { ChatService } from '../../data/chat.service';
import { MessageInputComponent } from '../message-input/message-input.component';
import { MessageListComponent } from '../message-list/message-list.component';
import { TypingIndicatorComponent } from '../typing-indicator/typing-indicator.component';

const COPIED_LABEL_MS = 1500;

@Component({
  selector: 'app-chat-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChatService],
  imports: [MessageListComponent, TypingIndicatorComponent, MessageInputComponent],
  templateUrl: './chat-container.component.html',
  styleUrls: ['./chat-container.component.scss'],
})
export class ChatContainerComponent implements OnInit, OnDestroy {
  readonly threadId = input.required<string>();
  readonly leave = output<void>();

  protected readonly chatService = inject(ChatService);
  private readonly chatApi = inject(ChatApiService);

  protected readonly ready = signal(false);
  protected readonly error = signal('');
  protected readonly sendFailed = signal(false);
  protected readonly copied = signal(false);

  private readonly reloadWhenAppReturns = (): void => {
    if (document.visibilityState === 'visible' && this.ready()) {
      void this.chatService.reloadLatestMessages();
    }
  };

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.reloadWhenAppReturns);
    void this.initialize();
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.reloadWhenAppReturns);
    void this.chatService.disconnect();
  }

  private async initialize(): Promise<void> {
    try {
      const issued = await this.chatApi.fetchToken();
      await this.chatService.connect(issued.acsUserId, issued.endpoint, issued.token);
      await this.chatService.openThread(this.threadId());
      this.ready.set(true);
    } catch (error) {
      // Message only: ACS errors can carry the chat token in their headers.
      console.error('Chat could not be opened:', error instanceof Error ? error.message : String(error));
      this.error.set(
        "Couldn't open that chat. Check your connection, the Thread ID, and that you've been added to it.",
      );
    }
  }

  protected async onSend(content: string): Promise<void> {
    this.sendFailed.set(false);
    try {
      await this.chatService.sendMessage(content);
    } catch {
      this.sendFailed.set(true);
    }
  }

  protected async copyThreadId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.threadId());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), COPIED_LABEL_MS);
    } catch {
      // Copying is a convenience, so a blocked clipboard is ignored.
    }
  }

  // Typing is optional, so failures are ignored.
  protected onTyping(): void {
    this.chatService.sendTypingNotification().catch(() => undefined);
  }
}
