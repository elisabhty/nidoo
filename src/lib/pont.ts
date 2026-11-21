// Le pont natif « Nidoo » de l'appli iPhone (ios/App/App/NidooPlugin.swift), déclaré une seule fois.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type EvenementCalendrier = { titre: string; debut: number; fin: number; journee: boolean; lieu?: string; notes?: string; repete?: string; rappel?: boolean }

export type Pont = {
  configurer(o: { url: string; apikey: string; cle: string; famille: string; moi: string }): Promise<{ refusee?: boolean }>
  personnages(o: { images: Record<string, string>; garder: string[] }): Promise<void>
  rafraichir(): Promise<void>
  oublier(): Promise<void>
  depart(): Promise<{ chemin?: string }>
  /** La fiche « Nouvel événement » du calendrier de l'iPhone, déjà remplie (iOS 17 et plus). */
  calendrier(o: EvenementCalendrier): Promise<{ action: 'ajoute' | 'annule' }>
  addListener(nom: 'ouvrir', f: (e: { chemin: string }) => void): Promise<PluginListenerHandle>
}

/** Vrai dans l'appli iPhone (le pont existe) ; sur le web et en démo, rien de tout ceci ne tourne. */
export const NATIF_IOS = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform()
export const pont = NATIF_IOS ? registerPlugin<Pont>('Nidoo') : null
