/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

const TYPING_THROTTLE_MS = 2000;

@Component({
  selector: 'app-message-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-input.component.html',
  styleUrls: ['./message-input.component.scss'],
})
export class MessageInputComponent {
  readonly send = output<string>();
  readonly typing = output<void>();

  protected readonly draft = signal('');
  private lastTypingEmitAt = 0;

  protected onDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);

    const now = Date.now();
    if (now - this.lastTypingEmitAt < TYPING_THROTTLE_MS) return;
    this.lastTypingEmitAt = now;
    this.typing.emit();
  }

  protected onSubmit(): void {
    const content = this.draft().trim();
    if (!content) return;

    this.send.emit(content);
    this.draft.set('');
  }
}
