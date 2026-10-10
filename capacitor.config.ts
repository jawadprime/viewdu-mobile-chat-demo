import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.viewdu.chat',
  appName: 'Viewdu Chat Demo',
  webDir: 'dist/viewdu-mobile-chat-demo/browser',
  // Dev only: lets the app call the local http chat-fxa. Remove once chat-fxa is on https.
  server: {
    androidScheme: 'http',
  },
};

export default config;
