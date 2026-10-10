/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

const { functionHostName, functionKey } = environment.config;

// Same headers as chat-ngx: x-web false = native app, x-b2c true = Entra External ID.
const STANDARD_HEADERS = { 'x-web': 'false', 'x-b2c': 'true', 'x-functions-key': functionKey };

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    return firstValueFrom(this.http.get<T>(functionHostName + path, { headers: { ...STANDARD_HEADERS, ...headers } }));
  }

  post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(functionHostName + path, body, { headers: { ...STANDARD_HEADERS, ...headers } }),
    );
  }
}
