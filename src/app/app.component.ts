/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { ChatContainerComponent } from './components/chat-container/chat-container.component';
import { AuthService } from './data/auth.service';
import { SessionService } from './data/session.service';
import { JoinComponent } from './pages/join/join.component';

type SignInState = 'signing-in' | 'signed-in' | 'failed';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatContainerComponent, JoinComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  // Going back in the history (Back button or the chat arrow) shows the join screen.
  host: { '(window:popstate)': 'threadId.set(null)' },
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);

  protected readonly signInState = signal<SignInState>('signing-in');
  protected readonly signInError = signal('');
  protected readonly threadId = signal<string | null>(null);

  constructor() {
    // Back goes back in the history, and closes the app only from the first screen.
    void App.addListener('backButton', ({ canGoBack }) => (canGoBack ? history.back() : App.exitApp()));
  }

  ngOnInit(): void {
    void this.signIn();
  }

  protected async signIn(): Promise<void> {
    this.signInState.set('signing-in');

    try {
      await this.session.signon(await this.auth.signIn());
      this.signInState.set('signed-in');
    } catch (error) {
      console.error('Sign-in failed:', error instanceof Error ? error.message : String(error));
      this.signInError.set(this.describeSignInError(error));
      this.signInState.set('failed');
    }
  }

  private describeSignInError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0
        ? "Can't reach the server. Check your connection and try again."
        : `The server answered with an error (${error.status}). Please try again.`;
    }

    const message = error instanceof Error ? error.message : '';
    // The plugin reports a closed sign-in page as a bare code like ERR_GENERAL.
    return /^[A-Z_]*$/.test(message) ? 'The sign-in was cancelled or did not finish. Please try again.' : message;
  }

  // The history entry gives the Back button something to go back to.
  protected openChat(threadId: string): void {
    history.pushState(null, '');
    this.threadId.set(threadId);
  }

  protected closeChat(): void {
    history.back();
  }
}
