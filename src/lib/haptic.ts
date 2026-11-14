import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Retours haptiques iOS ; sans effet sur le web.
const native = Capacitor.isNativePlatform()
export const tap = () => void (native && Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined))
export const select = () => void (native && Haptics.selectionChanged().catch(() => undefined))
export const success = () => void (native && Haptics.notification({ type: NotificationType.Success }).catch(() => undefined))
export const warn = () => void (native && Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined))
