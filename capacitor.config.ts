import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Guscio nativo opzionale (sezione 9.3 della specifica). Serve solo alla
 * distribuzione come APK: la webview è Chrome, quindi la Generic Sensor API
 * e la precisione sono le stesse della PWA.
 */
const config: CapacitorConfig = {
  appId: 'it.mobbys.livellacamper',
  appName: 'Livella camper',
  webDir: 'dist',
  android: {
    backgroundColor: '#0A0E12',
  },
}

export default config
