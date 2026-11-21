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
  },
}

export default config
