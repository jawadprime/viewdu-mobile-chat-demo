/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { GenericOAuth2 } from '@capacitor-community/generic-oauth2';
import type { IUserLogin } from '@viewdu/util-dto-lib';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

const { aadClientId, aadTenantId, aadRedirectUrl } = environment.config;

// Entra External ID, the same as the web app.
const OAUTH_URL = `https://${aadTenantId}.ciamlogin.com/${aadTenantId}/oauth2/v2.0`;

interface IGraphProfile {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  async signIn(): Promise<IUserLogin> {
    const result = await GenericOAuth2.authenticate({
      appId: aadClientId,
      authorizationBaseUrl: `${OAUTH_URL}/authorize`,
      accessTokenEndpoint: `${OAUTH_URL}/token`,
      scope: 'openid profile email offline_access User.Read',
      responseType: 'code',
      pkceEnabled: true,
      redirectUrl: aadRedirectUrl,
    });

    const { id_token: idToken, access_token: accessToken } = result.access_token_response ?? {};
    if (!idToken || !accessToken) {
      throw new Error('Microsoft did not return the sign-in tokens.');
    }

    const profile = await firstValueFrom(
      this.http.get<IGraphProfile>('https://graph.microsoft.com/v1.0/me/', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );

    return {
      idToken,
      accessToken,
      sessionToken: '',
      appAADUuid: aadClientId,
      tenancyAADUuid: aadTenantId,
      userAADUuid: profile.id,
      displayName: profile.displayName,
      firstName: profile.givenName,
      surname: profile.surname,
      email: profile.mail,
    };
  }
}
