// Les notifications : la permission, demandée à l'accueil (une page à elle, Elisa, 21 novembre).
// Dans l'appli iPhone, par le plugin des notifications locales (l'autorisation d'iOS vaut aussi pour celles qui viendront
// du serveur) ; sur le web, par le navigateur quand il sait le faire.
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export type Reponse = 'oui' | 'non' | 'indisponible'
const CLE = 'nidoo.notifications'

export function reponseNotifications(): Reponse | 'plus-tard' | null {
  try {
    return localStorage.getItem(CLE) as Reponse | 'plus-tard' | null
  } catch {
    return null
  }
}

export function noterNotifications(r: Reponse | 'plus-tard') {
  try {
    localStorage.setItem(CLE, r)
  } catch {
    /* sans conséquence */
  }
}

export async function demanderNotifications(): Promise<Reponse> {
  let r: Reponse = 'indisponible'
  try {
    if (Capacitor.isNativePlatform()) {
      const p = await LocalNotifications.requestPermissions()
      r = p.display === 'granted' ? 'oui' : 'non'
    } else if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
      r = (await Notification.requestPermission()) === 'granted' ? 'oui' : 'non'
    }
  } catch {
    r = 'indisponible'
  }
  noterNotifications(r)
  return r
}

/** Juste après le « oui » : un premier petit mot de Panda, pour voir à quoi ça ressemble. */
export async function premiereNotification(prenom: string) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: 'Panda 🐼',
          body: prenom ? `Coucou ${prenom} ! C’est comme ça que je te dirai quand un proche pense à toi 💗` : 'Coucou ! C’est comme ça que je te dirai quand un proche pense à toi 💗',
          schedule: { at: new Date(Date.now() + 2500) },
        },
      ],
    })
  } catch {
    /* pas grave */
  }
}
