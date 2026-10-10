/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { Injectable, inject, signal } from '@angular/core';
import type { IUserLogin } from '@viewdu/util-dto-lib';
import { ApiService } from './api.service';

interface ISignonResponse {
  session?: { token?: string; user?: { uuid?: string } };
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private readonly api = inject(ApiService);

  readonly sessionToken = signal<string | null>(null);
  // What other people enter to add this user to a chat.
  readonly userUuid = signal<string | null>(null);
  readonly displayName = signal<string | undefined>(undefined);

  // chat-fxa passes the sign-in to Viewdu Core, which validates it.
  async signon(login: IUserLogin): Promise<void> {
    const response = await this.api.post<ISignonResponse>('/api/cor-prv-auth-signon', login);

    if (!response.session?.token) {
      console.error('Viewdu signon failed', response);
      throw new Error('Viewdu did not accept the sign-in.');
    }

    this.sessionToken.set(response.session.token);
    this.userUuid.set(response.session.user?.uuid ?? null);
    this.displayName.set(login.displayName);
  }
}
