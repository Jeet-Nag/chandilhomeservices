import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.chandilservices.app',
  appName: 'Chandil Home Services',
  webDir: 'client/dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
