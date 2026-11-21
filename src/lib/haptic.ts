import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { jouer, sonGeste } from './sons'

// Retours haptiques iOS ; sans effet sur le web.
const native = Capacitor.isNativePlatform()
export const tap = () => void (native && Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined))
export const select = () => void (native && Haptics.selectionChanged().catch(() => undefined))
export const success = () => void (native && Haptics.notification({ type: NotificationType.Success }).catch(() => undefined))
/** Un petit choc plus marqué : un article qui part de la liste. */
export const choc = () => void (native && Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined))
export const warn = () => void (native && Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined))

// Le geste se sent dans la main : chaque attention a sa vibration.
// [style, attente avant] — câlin : une longue étreinte ; bisou : deux petits « smack » ; cœur : un battement.
const FEEL: Record<string, [ImpactStyle, number][]> = {
  calin: [[ImpactStyle.Light, 0], [ImpactStyle.Medium, 90], [ImpactStyle.Heavy, 90], [ImpactStyle.Medium, 160], [ImpactStyle.Light, 160]],
  bisou: [[ImpactStyle.Medium, 0], [ImpactStyle.Light, 110]],
  coeur: [[ImpactStyle.Heavy, 0], [ImpactStyle.Medium, 150], [ImpactStyle.Heavy, 650], [ImpactStyle.Medium, 150]],
  courage: [[ImpactStyle.Heavy, 0], [ImpactStyle.Heavy, 140], [ImpactStyle.Heavy, 140]],
  mot: [[ImpactStyle.Light, 0], [ImpactStyle.Light, 90]],
}
const VIBRATE: Record<string, number[]> = {
  calin: [70, 50, 90, 50, 260],
  bisou: [35, 90, 35],
  coeur: [60, 110, 60, 560, 60, 110, 60],
  courage: [60, 60, 60, 60, 140],
  mot: [25, 50, 25],
}
// …et s'entend : chaque attention a aussi son petit son (voir sons.ts).
export function feel(kind: string) {
  jouer(sonGeste(kind))
  const steps = FEEL[kind] ?? FEEL.coeur
  if (native) {
    let at = 0
    for (const [style, wait] of steps) {
      at += wait
      window.setTimeout(() => void Haptics.impact({ style }).catch(() => undefined), at)
    }
  } else if ('vibrate' in navigator) {
    try {
      navigator.vibrate(VIBRATE[kind] ?? VIBRATE.coeur)
    } catch {
      /* pas de vibration sur ce navigateur */
    }
  }
}
