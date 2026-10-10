# Viewdu Mobile Chat Demo

An Android example of the Viewdu Chat feature, built with Angular and Capacitor. It signs in with the same Entra External ID app registration as `viewdu-chat` (chat-ngx), talks to the same `chat-fxa` backend, and chats through Azure Communication Services (ACS).

Scope: chat only (sign in, start a chat, join a chat by Thread ID, send and receive messages, typing indicator, read receipts). It shows only the latest 50 messages of a chat.

## How it works

```
1. Sign in      system browser (Entra External ID, Authorization Code + PKCE)  -> ID token + access token
2. Signon       POST /api/cor-prv-auth-signon   (chat-fxa passes it to Viewdu Core)  -> Viewdu session
3. Chat token   GET  /api/cht-prv-lags-chat/    (session header)                     -> ACS user id, endpoint, token
4. Chat         ACS chat SDK talks to ACS directly
```

The app is an Angular app running inside a native Android shell (Capacitor WebView). Only two things are native: the sign-in (`@capacitor-community/generic-oauth2`) and the Android Back button (`@capacitor/app`). Back leaves a chat for the join screen, and closes the app from the join screen.

## Project structure

```
src/app/
  app.component.*            signs in, then shows the join page or the chat
  data/
    api.service.ts           HTTP calls to chat-fxa with the standard Viewdu headers
    auth.service.ts          sign-in and the Microsoft Graph profile lookup
    session.service.ts       Viewdu signon, session token, user id
    chat-api.service.ts      chat token request (same shape as chat-ngx)
    chat.service.ts          ACS logic, based on chat-ngx's chat.service.ts (see below)
  components/                chat-container, message-list, message-item, message-input, typing-indicator
  pages/join/                first screen: your Viewdu ID, start a chat, join by Thread ID
src/environments/            settings
src/viewdu-chat-tokens.css   design tokens, copied from chat-ngx
android/                     the native Android project made by Capacitor
```

The folder layout, file names, tokens and `chat.service.ts` follow `viewdu-chat/projects/chat-ngx/.../viewdu-chat`. `chat.service.ts` is chat-ngx's, trimmed in two ways: the sender's name comes from the session, and it loads only the latest 50 messages (no scrolling back through older ones). Diff the two files if chat-ngx's version changes.

## Run it

Needs: Node 22.22.3 or newer on 22.x (or 24.15+, or 26+), Android Studio, and an npm login that can read the private `@viewdu` packages (`@viewdu/chat-dto-lib` and `@viewdu/util-dto-lib`). Without it `npm install` stops with a 404. Run `npm login` with an account in the `@viewdu` npm organisation, or put a token for it in your user `.npmrc`.

```bash
npm install
npm run build
npx cap sync android
```

Then open the `android` folder in Android Studio and press Run. Build from Android Studio, not with `gradlew` on the command line (on some Windows machines the Gradle daemon fails with "Unable to establish loopback connection").

The backend must be running first. From the `viewdu-chat` repo, start Azurite (the storage emulator) and wait until it is up, then:

```bash
npm run build:fxa:ts
cd projects/chat-fxa
func start --cors "*"
```

`--cors "*"` is needed because the app runs in a WebView and calls the API from another origin.

Run the tests with `npm test`.

## Try it

You need two people in one chat, so use two accounts.

1. Run the app (see above) and sign in. The join screen shows **Your Viewdu ID**. Tap **Copy**.
2. In the web app (chat-ngx), signed in as the other person, copy their Viewdu ID.
3. In the mobile app, paste it under **Start a chat** and tap **Start chat**. The chat opens. Tap **Copy Thread ID** and paste it in the web app to join. (Several IDs can be separated by commas.)

You can also start the chat in the web app and paste its Thread ID under **Join a chat** in the mobile app.

Then send messages both ways. You should see names, the time, "Seen" under your messages, and "is typing…".

## Settings

Everything is in `src/environments/environment.ts`:

| Setting | Meaning |
|---|---|
| `functionHostName` | chat-fxa address. The Android emulator reaches your computer at `10.0.2.2`. A real phone needs your computer's network IP. |
| `functionKey` | Azure Functions key. Empty is fine locally. A deployed chat-fxa needs it. |
| `aadClientId`, `aadTenantId` | The existing Chat app registration (the same one chat-ngx uses). |
| `aadRedirectUrl` | Where Entra sends the user back to the app. Must be on the app registration's redirect list. |

## Sign-in notes

- The redirect is `msauth://dev.viewdu.chat/<url-encoded signature hash>`, registered under the app registration's Android platform. The plugin does not check the hash against the signing key, so the app signs in from any computer or signing key. `android/app/build.gradle` sets `appAuthRedirectScheme` to `msauth` so Android hands the redirect back to the app.
- For iOS, add a redirect under "Mobile and desktop applications" in the app registration (for example `msal<clientId>://auth`) and use it as `aadRedirectUrl`.
- There is no silent sign-in yet. Chrome opens each time the app starts, and Microsoft shows "Are you trying to sign in to Viewdu Dev?". Tap **Continue**. Storing the refresh token (`offline_access` is already requested) would remove the extra step.
- The app signs in with the account Chrome on the device remembers. There is no sign-out or switch-account button yet. To use another account, sign out of Microsoft in Chrome on the device first.
- Do not enable the plugin's `logsEnabled` option: it writes tokens to the device log.

## Known limits

- It shows the latest 50 messages. Messages sent while the phone was asleep are loaded again when the app comes back to the screen.
- Messages are one line. There are no avatars.
- If a message fails to send, the app says so, but the text is not kept. Type it again.
- If the Viewdu session ever expires, the chat cannot get a new token. Close and reopen the app to sign in again.
- Leaving a chat while it is still connecting can leave the connection open until the app closes.

## Before using a deployed backend

1. Set `functionHostName` (https) and `functionKey`.
2. In `capacitor.config.ts`, remove `server.androidScheme: 'http'` (it only exists so the app can call a local http server).
3. Remove `android:networkSecurityConfig` from `AndroidManifest.xml` and delete `res/xml/network_security_config.xml` (it only allows plain http to `10.0.2.2`).
4. On the Function App, allow the origin `https://localhost` in CORS. That is where the app runs inside the WebView once `androidScheme: 'http'` is removed. Locally, `--cors "*"` covers it.
5. `functionKey` ends up inside the app, so anyone can read it from the package. Treat it as public, the same as in the web app.
6. To hand the app to testers, build a signed release in Android Studio (Build, then Generate Signed Bundle / APK) with your own keystore. Keep the keystore out of git.
