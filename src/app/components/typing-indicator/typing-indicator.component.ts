/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './typing-indicator.component.html',
  styleUrls: ['./typing-indicator.component.scss'],
})
export class TypingIndicatorComponent {
  readonly typingUsers = input.required<ReadonlySet<string>>();

  protected readonly label = computed(() => {
    const count = this.typingUsers().size;
    if (count === 0) return '';
    return count === 1 ? 'Someone is typing…' : `${count} people are typing…`;
  });
}
