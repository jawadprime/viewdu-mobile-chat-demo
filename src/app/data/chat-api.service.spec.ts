/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { ChatApiService } from './chat-api.service';
import { SessionService } from './session.service';

describe('ChatApiService', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  function create(): ChatApiService {
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: SessionService, useValue: { sessionToken: signal('session-1') } },
      ],
    });
    return TestBed.inject(ChatApiService);
  }

  const headersFor = (operation: string) => ({
    'x-auth-session': 'session-1',
    query: JSON.stringify({ operation }),
  });

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn() };
  });

  it('asks for a chat token with the Viewdu session', async () => {
    api.get.mockResolvedValue({ data: { acsUserId: 'me', endpoint: 'https://acs.example', token: 'token' } });

    const issued = await create().fetchToken();

    expect(api.get).toHaveBeenCalledWith('/api/cht-prv-lags-chat/', headersFor('get'));
    expect(issued.token).toBe('token');
  });

  it('fails when no token comes back', async () => {
    api.get.mockResolvedValue({});

    await expect(create().fetchToken()).rejects.toThrow('Chat did not return a token.');
  });

  it('creates a thread for the given people and returns its id', async () => {
    api.post.mockResolvedValue({ data: { threadId: 'thread-9' } });

    const threadId = await create().createThread(['id-1', 'id-2']);

    expect(api.post).toHaveBeenCalledWith(
      '/api/cht-prv-lags-chat/',
      { participantAppUserUuids: ['id-1', 'id-2'] },
      headersFor('save'),
    );
    expect(threadId).toBe('thread-9');
  });

  it('fails when no thread comes back', async () => {
    api.post.mockResolvedValue({});

    await expect(create().createThread(['id-1'])).rejects.toThrow('Chat did not return a thread.');
  });
});
