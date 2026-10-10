/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageInputComponent } from './message-input.component';

describe('MessageInputComponent', () => {
  let fixture: ComponentFixture<MessageInputComponent>;
  let field: HTMLInputElement;
  let form: HTMLFormElement;
  const sent: string[] = [];
  let typingEmits = 0;

  function type(text: string): void {
    field.value = text;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    sent.length = 0;
    typingEmits = 0;

    fixture = TestBed.createComponent(MessageInputComponent);
    fixture.componentInstance.send.subscribe((content) => sent.push(content));
    fixture.componentInstance.typing.subscribe(() => typingEmits++);
    fixture.detectChanges();

    field = fixture.nativeElement.querySelector('input');
    form = fixture.nativeElement.querySelector('form');
  });

  it('sends the trimmed text and clears the field', () => {
    type('  hello  ');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(sent).toEqual(['hello']);
    expect(field.value).toBe('');
  });

  it('does not send an empty message', () => {
    type('   ');
    form.dispatchEvent(new Event('submit'));

    expect(sent).toEqual([]);
  });

  it('only reports "typing" once for quick key presses', () => {
    type('h');
    type('he');
    type('hel');

    expect(typingEmits).toBe(1);
  });
});
