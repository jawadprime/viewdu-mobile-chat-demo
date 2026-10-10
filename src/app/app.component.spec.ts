/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { ChatContainerComponent } from './components/chat-container/chat-container.component';
import { AuthService } from './data/auth.service';
import { SessionService } from './data/session.service';

const flush = () => new Promise((resolve) => setTimeout(resolve));

// Stand-in for the real chat screen.
@Component({ selector: 'app-chat-container', template: '<button class="leave" (click)="leave.emit()">Back</button>' })
class StubChatContainerComponent {
  readonly threadId = input.required<string>();
  readonly leave = output<void>();
}

describe('AppComponent', () => {
  let signIn: ReturnType<typeof vi.fn>;
  let signon: ReturnType<typeof vi.fn>;

  async function create(): Promise<ComponentFixture<AppComponent>> {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { signIn } },
        { provide: SessionService, useValue: { signon, userUuid: signal('my-viewdu-id'), displayName: signal('Me') } },
      ],
    });
    TestBed.overrideComponent(AppComponent, {
      remove: { imports: [ChatContainerComponent] },
      add: { imports: [StubChatContainerComponent] },
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ComponentFixture<AppComponent>) => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const joinChat = (fixture: ComponentFixture<AppComponent>) => {
    fixture.debugElement.query(By.css('app-join')).triggerEventHandler('join', 'thread-1');
    fixture.detectChanges();
  };

  beforeEach(() => {
    signIn = vi.fn().mockResolvedValue({ idToken: 'id', accessToken: 'access' });
    signon = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
  });

  it('signs in on start and then shows the join screen', async () => {
    const fixture = await create();

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signon).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.query(By.css('app-join'))).toBeTruthy();
  });

  it('says in plain words when the sign-in page was cancelled, and lets the user try again', async () => {
    // What the plugin reports when the page is closed.
    signIn.mockRejectedValueOnce(new Error('ERR_GENERAL'));
    const fixture = await create();
    expect(text(fixture)).toContain("Couldn't sign you in");
    expect(text(fixture)).toContain('cancelled or did not finish');
    expect(text(fixture)).not.toContain('ERR_GENERAL');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    await flush();
    fixture.detectChanges();

    expect(signIn).toHaveBeenCalledTimes(2);
    expect(fixture.debugElement.query(By.css('app-join'))).toBeTruthy();
  });

  it('says the server cannot be reached, without showing its address', async () => {
    const failure = new HttpErrorResponse({ status: 0, url: 'http://10.0.2.2:7071/api/cor-prv-auth-signon' });
    signon.mockRejectedValueOnce(failure);

    const text1 = text(await create());

    expect(text1).toContain("Can't reach the server");
    expect(text1).not.toContain('10.0.2.2');
  });

  it('shows our own readable messages as they are', async () => {
    signon.mockRejectedValueOnce(new Error('Viewdu did not accept the sign-in.'));

    expect(text(await create())).toContain('Viewdu did not accept the sign-in.');
  });

  it('opens the chat, and adds a history entry so the Back button has somewhere to go', async () => {
    const fixture = await create();

    joinChat(fixture);

    expect(fixture.debugElement.query(By.css('app-chat-container'))).toBeTruthy();
    expect(history.pushState).toHaveBeenCalledTimes(1);
  });

  it('goes back to the join screen when the Back button is pressed', async () => {
    const fixture = await create();
    joinChat(fixture);

    window.dispatchEvent(new PopStateEvent('popstate'));
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('app-chat-container'))).toBeNull();
    expect(fixture.debugElement.query(By.css('app-join'))).toBeTruthy();
  });

  it('makes the arrow in the chat go back through the history, like the Back button', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const fixture = await create();
    joinChat(fixture);

    fixture.debugElement.query(By.css('app-chat-container')).triggerEventHandler('leave');

    expect(back).toHaveBeenCalledTimes(1);
  });
});
