/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { ChatApiService } from '../../data/chat-api.service';
import { SessionService } from '../../data/session.service';

const COPIED_LABEL_MS = 1500;

@Component({
  selector: 'app-join',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss'],
})
export class JoinComponent {
  protected readonly session = inject(SessionService);
  private readonly chatApi = inject(ChatApiService);

  readonly join = output<string>();

  protected readonly threadId = signal('');
  protected readonly participantIds = signal('');
  protected readonly starting = signal(false);
  protected readonly startError = signal('');
  protected readonly copied = signal(false);

  protected onThreadIdInput(event: Event): void {
    this.threadId.set((event.target as HTMLInputElement).value);
  }

  protected onParticipantIdsInput(event: Event): void {
    this.participantIds.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(): void {
    const threadId = this.threadId().trim();
    if (threadId) this.join.emit(threadId);
  }

  protected async onStart(): Promise<void> {
    const participantIds = this.participantIds()
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (participantIds.length === 0) return;

    this.starting.set(true);
    this.startError.set('');
    try {
      this.join.emit(await this.chatApi.createThread(participantIds));
    } catch (error) {
      console.error('Chat could not be started:', error instanceof Error ? error.message : String(error));
      this.startError.set("Couldn't start the chat. Check the Viewdu ID and your connection.");
    } finally {
      this.starting.set(false);
    }
  }

  protected async copyUserId(userId: string): Promise<void> {
    await navigator.clipboard.writeText(userId);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), COPIED_LABEL_MS);
  }
}
