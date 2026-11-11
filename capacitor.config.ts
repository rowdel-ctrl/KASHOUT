import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ph.store.cashoutlog',
  appName: 'Cash-out Log',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      // The web Firebase SDK signs in with the Google token from the native dialog.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
