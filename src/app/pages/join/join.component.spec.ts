/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatApiService } from '../../data/chat-api.service';
import { SessionService } from '../../data/session.service';
import { JoinComponent } from './join.component';

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('JoinComponent', () => {
  let createThread: ReturnType<typeof vi.fn>;
  let opened: string[];

  function create(): ComponentFixture<JoinComponent> {
    TestBed.configureTestingModule({
      providers: [
        { provide: ChatApiService, useValue: { createThread } },
        { provide: SessionService, useValue: { userUuid: signal('my-viewdu-id') } },
      ],
    });
    const fixture = TestBed.createComponent(JoinComponent);
    fixture.componentInstance.join.subscribe((threadId) => opened.push(threadId));
    fixture.detectChanges();
    return fixture;
  }

  const field = (fixture: ComponentFixture<JoinComponent>, id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`)!;
  const startButton = (fixture: ComponentFixture<JoinComponent>) =>
    field(fixture, 'participant-ids').closest('form')!.querySelector<HTMLButtonElement>('button')!;

  function type(fixture: ComponentFixture<JoinComponent>, id: string, value: string): void {
    const input = field(fixture, id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(fixture: ComponentFixture<JoinComponent>, id: string): Promise<void> {
    field(fixture, id)
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    fixture.detectChanges();
  }

  beforeEach(() => {
    createThread = vi.fn().mockResolvedValue('new-thread');
    opened = [];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('starts a chat with the typed Viewdu IDs and opens it', async () => {
    const fixture = create();

    type(fixture, 'participant-ids', ' id-1, id-2 ,');
    await submit(fixture, 'participant-ids');

    expect(createThread).toHaveBeenCalledWith(['id-1', 'id-2']);
    expect(opened).toEqual(['new-thread']);
  });

  it('cannot start a chat until an ID is typed', () => {
    const fixture = create();
    expect(startButton(fixture).disabled).toBe(true);

    type(fixture, 'participant-ids', 'id-1');

    expect(startButton(fixture).disabled).toBe(false);
  });

  it('shows an error when the chat cannot be started, and lets the user try again', async () => {
    createThread.mockRejectedValueOnce(new Error('offline'));
    const fixture = create();
    type(fixture, 'participant-ids', 'id-1');

    await submit(fixture, 'participant-ids');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Couldn't start the chat");
    expect(opened).toEqual([]);
    expect(startButton(fixture).disabled).toBe(false);

    await submit(fixture, 'participant-ids');

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain("Couldn't start the chat");
    expect(opened).toEqual(['new-thread']);
  });

  it('joins an existing chat by its Thread ID', async () => {
    const fixture = create();

    type(fixture, 'thread-id', ' thread-7 ');
    await submit(fixture, 'thread-id');

    expect(opened).toEqual(['thread-7']);
    expect(createThread).not.toHaveBeenCalled();
  });
});
