/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { TestBed } from '@angular/core/testing';
import { TypingIndicatorComponent } from './typing-indicator.component';

describe('TypingIndicatorComponent', () => {
  function render(typingUsers: string[]): string {
    const fixture = TestBed.createComponent(TypingIndicatorComponent);
    fixture.componentRef.setInput('typingUsers', new Set(typingUsers));
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
  }

  it('shows nothing when nobody is typing', () => {
    expect(render([])).toBe('');
  });

  it('says "Someone" when one person is typing', () => {
    expect(render(['a'])).toBe('Someone is typing…');
  });

  it('counts the people when several are typing', () => {
    expect(render(['a', 'b', 'c'])).toBe('3 people are typing…');
  });
});
