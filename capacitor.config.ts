import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'com.getupworkspace.nidoo',
  appName: 'NIDOO',
  webDir: 'dist',
  // la vue de l'appli ne défile jamais (ce qui défile, ce sont les écrans à l'intérieur) ;
  // le clavier ne la rétrécit pas : l'appli se cale elle-même au-dessus (src/lib/useKeyboardViewport.ts)
  ios: { contentInset: 'never', backgroundColor: '#F8F7FC', scrollEnabled: false },
  plugins: {
    Keyboard: { resize: KeyboardResize.None, style: KeyboardStyle.Light, resizeOnFullScreen: true },
    // la mise à jour à distance, en mode manuel et sans service tiers : rien n'est envoyé à Capgo
    // (ni vérification, ni statistiques) ; l'appli ne lit que le site de Nidoo (src/lib/majDistance.ts)
    CapacitorUpdater: { autoUpdate: false, updateUrl: '', statsUrl: '', channelUrl: '', appReadyTimeout: 20000, responseTimeout: 60, resetWhenUpdate: true },
  },
}

export default config
