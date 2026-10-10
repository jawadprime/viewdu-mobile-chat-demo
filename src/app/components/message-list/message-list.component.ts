/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import { IChatMessage } from '@viewdu/chat-dto-lib';
import { MessageItemComponent } from '../message-item/message-item.component';

const NEAR_BOTTOM_PX = 140;

@Component({
  selector: 'app-message-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessageItemComponent],
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.scss'],
})
export class MessageListComponent {
  readonly messages = input.required<IChatMessage[]>();
  readonly readMessageIds = input<ReadonlySet<string>>(new Set());

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');

  private lastMessageId?: string;

  constructor() {
    afterRenderEffect(() => this.scrollToNewest(this.messages()));
  }

  protected isFirstMessageFromSender(index: number): boolean {
    const messages = this.messages();
    return messages[index - 1]?.senderAcsUserId !== messages[index].senderAcsUserId;
  }

  private scrollToNewest(messages: IChatMessage[]): void {
    const last = messages[messages.length - 1];
    if (!last || last.id === this.lastMessageId) return;

    const el = this.viewport().nativeElement;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (this.lastMessageId === undefined || nearBottom || last.isOwnMessage) {
      el.scrollTop = el.scrollHeight;
    }

    this.lastMessageId = last.id;
  }
}
