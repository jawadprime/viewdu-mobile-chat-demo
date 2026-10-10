/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { TestBed } from '@angular/core/testing';
import type {
  ChatMessageReceivedEvent,
  ChatThreadClient,
  ReadReceiptReceivedEvent,
  TypingIndicatorReceivedEvent,
} from '@azure/communication-chat';
import { ChatApiService } from './chat-api.service';
import { ChatService } from './chat.service';
import { SessionService } from './session.service';

const THIS_CHAT = 'thread-1';
const OTHER_CHAT = 'thread-2';
const ME = 'me';
const SOMEONE = 'someone';

// The handlers get fake events. Private members are reached with brackets, in tests only.
describe('ChatService', () => {
  let service: ChatService;
  let sendReadReceipt: ReturnType<typeof vi.fn>;

  const message = (overrides: Record<string, unknown> = {}) =>
    ({
      threadId: THIS_CHAT,
      id: 'm1',
      type: 'Text',
      message: 'hello',
      sender: { communicationUserId: SOMEONE },
      senderDisplayName: 'Someone',
      createdOn: new Date('2026-01-01T10:00:00Z'),
      ...overrides,
    }) as unknown as ChatMessageReceivedEvent;

  const typing = (threadId: string) =>
    ({ threadId, sender: { communicationUserId: SOMEONE } }) as unknown as TypingIndicatorReceivedEvent;

  const receipt = (threadId: string, chatMessageId: string) =>
    ({ threadId, chatMessageId, sender: { communicationUserId: SOMEONE } }) as unknown as ReadReceiptReceivedEvent;

  const onScreen = (visible: boolean) =>
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visible ? 'visible' : 'hidden');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ChatApiService, useValue: {} },
        { provide: SessionService, useValue: { displayName: () => 'Me' } },
      ],
    });
    service = TestBed.inject(ChatService);

    sendReadReceipt = vi.fn().mockResolvedValue(undefined);
    service['threadId'] = THIS_CHAT;
    service['ownAcsUserId'] = ME;
    service['threadClient'] = { sendReadReceipt } as unknown as ChatThreadClient;
    onScreen(true);
  });

  it('shows a live message from this chat', () => {
    service['handleMessageReceived'](message());

    expect(service.messages().map((m) => m.content)).toEqual(['hello']);
  });

  it('ignores a live message that belongs to another chat', () => {
    service['handleMessageReceived'](message({ threadId: OTHER_CHAT }));

    expect(service.messages()).toEqual([]);
  });

  it('shows a message once, even if it arrives twice', () => {
    service['handleMessageReceived'](message());
    service['handleMessageReceived'](message());

    expect(service.messages().length).toBe(1);
  });

  it('keeps the oldest message first when history arrives after a live message', () => {
    service['handleMessageReceived'](
      message({ id: 'new', message: 'newer', createdOn: new Date('2026-01-01T10:05:00Z') }),
    );
    service['addMessages']([
      {
        id: 'old',
        senderAcsUserId: SOMEONE,
        senderDisplayName: 'Someone',
        content: 'older',
        createdOn: new Date('2026-01-01T10:00:00Z'),
        isOwnMessage: false,
      },
    ]);

    expect(service.messages().map((m) => m.content)).toEqual(['older', 'newer']);
  });

  it('sends "Seen" for a new message only while the app is on screen', () => {
    onScreen(false);
    service['handleMessageReceived'](message({ id: 'while-away' }));
    expect(sendReadReceipt).not.toHaveBeenCalled();

    onScreen(true);
    service['handleMessageReceived'](message({ id: 'while-looking', createdOn: new Date('2026-01-01T10:01:00Z') }));
    expect(sendReadReceipt).toHaveBeenCalledWith({ chatMessageId: 'while-looking' });
  });

  it('shows "is typing" only for this chat', () => {
    service['handleTypingIndicator'](typing(OTHER_CHAT));
    expect(service.typingUsers().size).toBe(0);

    service['handleTypingIndicator'](typing(THIS_CHAT));
    expect(service.typingUsers().size).toBe(1);

    void service.disconnect();
  });

  it("marks my messages as seen only from this chat's read receipts", () => {
    service['handleMessageReceived'](message({ id: 'mine', sender: { communicationUserId: ME } }));

    service['handleReadReceipt'](receipt(OTHER_CHAT, 'mine'));
    expect(service.readMessageIds().has('mine')).toBe(false);

    service['handleReadReceipt'](receipt(THIS_CHAT, 'mine'));
    expect(service.readMessageIds().has('mine')).toBe(true);
  });

  it('brings in messages that were missed while the app was away', async () => {
    service['handleMessageReceived'](message({ id: 'before', message: 'before' }));
    // ACS lists the newest first.
    const missed = {
      id: 'missed',
      type: 'text',
      sender: { communicationUserId: SOMEONE },
      senderDisplayName: 'Someone',
      content: { message: 'sent while away' },
      createdOn: new Date('2026-01-01T11:00:00Z'),
    };
    const before = {
      id: 'before',
      type: 'text',
      sender: { communicationUserId: SOMEONE },
      senderDisplayName: 'Someone',
      content: { message: 'before' },
      createdOn: new Date('2026-01-01T10:00:00Z'),
    };
    service['threadClient'] = {
      sendReadReceipt,
      listMessages: () => ({
        byPage: () =>
          (async function* () {
            yield [missed, before];
          })(),
      }),
    } as unknown as ChatThreadClient;

    await service.reloadLatestMessages();

    expect(service.messages().map((m) => m.content)).toEqual(['before', 'sent while away']);
  });
});
