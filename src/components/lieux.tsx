import { useState } from 'react'
import type { Shop } from '../lib/data'
import { CentrePage } from './centre'
import { CompagnonPage } from './compagnon'
import { JeuxPage } from './jeux'
import { PotagerPage } from './potager'

// Les lieux de la maison qui s'ouvrent en pages : le compagnon, le potager, le centre commercial, les jeux.
// Une page peut en ouvrir une autre (le compagnon envoie à l'animalerie) : elles s'empilent.

export type Lieu = { k: 'compagnon' } | { k: 'potager' } | { k: 'centre'; shop?: Shop } | { k: 'jeux'; game?: string }

export function useLieux() {
  const [stack, setStack] = useState<Lieu[]>([])
  const open = (l: Lieu) => setStack((s) => [...s, l])
  const node = stack.map((l, i) => {
    const close = () => setStack((s) => s.slice(0, i))
    const shop = (sh: Shop) => setStack((s) => [...s.slice(0, i + 1), { k: 'centre', shop: sh }])
    const key = `${l.k}${i}`
    if (l.k === 'compagnon') return <CompagnonPage key={key} onClose={close} onShop={shop} />
    if (l.k === 'potager') return <PotagerPage key={key} onClose={close} onShop={shop} />
    if (l.k === 'jeux') return <JeuxPage key={key} onClose={close} start={l.game} />
    return <CentrePage key={key} onClose={close} start={l.shop} />
  })
  return { open, node, isOpen: stack.length > 0 }
}
