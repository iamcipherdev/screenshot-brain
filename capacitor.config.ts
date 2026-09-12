import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cipher.screenshotbrain',
  appName: 'Screenshot Brain',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0F1110',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
    },
  },
};

export default config;
