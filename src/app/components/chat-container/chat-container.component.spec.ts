/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { IChatMessage } from '@viewdu/chat-dto-lib';
import { ChatApiService } from '../../data/chat-api.service';
import { ChatService } from '../../data/chat.service';
import { ChatContainerComponent } from './chat-container.component';

const flush = () => new Promise((resolve) => setTimeout(resolve));

// Stand-in for the real ChatService (no network, no Azure).
function fakeChatService() {
  return {
    messages: signal<IChatMessage[]>([]),
    typingUsers: signal<ReadonlySet<string>>(new Set()),
    readMessageIds: signal<ReadonlySet<string>>(new Set()),
    connect: vi.fn().mockResolvedValue(undefined),
    openThread: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendTypingNotification: vi.fn().mockResolvedValue(undefined),
    reloadLatestMessages: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ChatContainerComponent', () => {
  let chat: ReturnType<typeof fakeChatService>;
  let fetchToken: ReturnType<typeof vi.fn>;

  function create(): ComponentFixture<ChatContainerComponent> {
    TestBed.configureTestingModule({ providers: [{ provide: ChatApiService, useValue: { fetchToken } }] });
    TestBed.overrideComponent(ChatContainerComponent, {
      set: { providers: [{ provide: ChatService, useValue: chat }] },
    });

    const fixture = TestBed.createComponent(ChatContainerComponent);
    fixture.componentRef.setInput('threadId', 'thread-1');
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<ChatContainerComponent>): Promise<string> {
    await flush();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    chat = fakeChatService();
    fetchToken = vi.fn().mockResolvedValue({ acsUserId: 'me', endpoint: 'https://acs.example', token: 'token' });
    // Keeps the test output quiet.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shows "Connecting…" until the chat is open, then the chat', async () => {
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Connecting');

    const text = await settle(fixture);

    expect(text).not.toContain('Connecting');
    expect(fixture.debugElement.query(By.css('app-message-list'))).toBeTruthy();
  });

  it('connects with the issued token and opens the thread', async () => {
    await settle(create());

    expect(chat.connect).toHaveBeenCalledWith('me', 'https://acs.example', 'token');
    expect(chat.openThread).toHaveBeenCalledWith('thread-1');
  });

  it('shows one error when the token cannot be fetched', async () => {
    fetchToken.mockRejectedValue(new Error('no token'));
    const fixture = create();

    const text = await settle(fixture);

    expect(text).toContain("Couldn't open that chat");
    expect(fixture.debugElement.query(By.css('app-message-list'))).toBeNull();
  });

  it('shows the same error when the thread cannot be opened', async () => {
    chat.openThread.mockRejectedValue(new Error('not a member'));

    const text = await settle(create());

    expect(text).toContain("Couldn't open that chat");
  });

  it('tells the user when a message could not be sent, and clears that on the next try', async () => {
    const fixture = create();
    await settle(fixture);
    const input = fixture.debugElement.query(By.css('app-message-input'));

    chat.sendMessage.mockRejectedValueOnce(new Error('offline'));
    input.triggerEventHandler('send', 'hello');
    expect(await settle(fixture)).toContain("Couldn't send that message");

    input.triggerEventHandler('send', 'hello again');
    expect(await settle(fixture)).not.toContain("Couldn't send that message");
  });

  it('disconnects when the chat is left', async () => {
    const fixture = create();
    await settle(fixture);

    fixture.destroy();

    expect(chat.disconnect).toHaveBeenCalled();
  });

  describe('copying the Thread ID', () => {
    const useClipboard = (writeText: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const copyButton = (fixture: ComponentFixture<ChatContainerComponent>) =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.copy-button')!;

    it('copies it and says so', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      useClipboard(writeText);
      const fixture = create();

      copyButton(fixture).click();

      expect(writeText).toHaveBeenCalledWith('thread-1');
      expect(await settle(fixture)).toContain('Copied');
    });

    it('stays quiet when the clipboard is blocked', async () => {
      useClipboard(vi.fn().mockRejectedValue(new Error('blocked')));
      const fixture = create();

      copyButton(fixture).click();

      expect(await settle(fixture)).toContain('Copy Thread ID');
    });
  });

  describe('when the app comes back from the background', () => {
    const comeBack = (state: 'visible' | 'hidden') => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
      document.dispatchEvent(new Event('visibilitychange'));
    };

    it('reloads the latest messages', async () => {
      const fixture = create();
      await settle(fixture);

      comeBack('hidden');
      expect(chat.reloadLatestMessages).not.toHaveBeenCalled();

      comeBack('visible');
      expect(chat.reloadLatestMessages).toHaveBeenCalledTimes(1);
    });

    it('does nothing while the chat is still connecting', () => {
      create();

      comeBack('visible');

      expect(chat.reloadLatestMessages).not.toHaveBeenCalled();
    });

    it('stops listening once the chat is left', async () => {
      const fixture = create();
      await settle(fixture);
      fixture.destroy();

      comeBack('visible');

      expect(chat.reloadLatestMessages).not.toHaveBeenCalled();
    });
  });
});
