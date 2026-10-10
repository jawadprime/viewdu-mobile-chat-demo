/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { Injectable, inject } from '@angular/core';
import { ICreatedThread, IIssuedToken } from '@viewdu/chat-dto-lib';
import { LAGS_OPERATION_GET, LAGS_OPERATION_SAVE } from '@viewdu/util-dto-lib';
import { ApiService } from './api.service';
import { SessionService } from './session.service';

const CHAT_API_PATH = '/api/cht-prv-lags-chat/';

@Injectable({
  providedIn: 'root',
})
export class ChatApiService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  // chat-fxa answers 200 even on failure, so check for the token.
  async fetchToken(): Promise<IIssuedToken> {
    const response = await this.api.get<{ data?: IIssuedToken }>(CHAT_API_PATH, this.headersFor(LAGS_OPERATION_GET));

    if (!response.data?.token) {
      throw new Error('Chat did not return a token.');
    }
    return response.data;
  }

  async createThread(participantAppUserUuids: string[]): Promise<string> {
    const response = await this.api.post<{ data?: ICreatedThread }>(
      CHAT_API_PATH,
      { participantAppUserUuids },
      this.headersFor(LAGS_OPERATION_SAVE),
    );

    if (!response.data?.threadId) {
      throw new Error('Chat did not return a thread.');
    }
    return response.data.threadId;
  }

  private headersFor(operation: string): Record<string, string> {
    return { 'x-auth-session': this.session.sessionToken() ?? '', query: JSON.stringify({ operation }) };
  }
}
