// Un enfant ou un bébé sans téléphone : on l'ajoute depuis Famille, ou dès l'accueil quand on est encore seul
// (Elisa, 26 novembre, les cinq familles : les Martin et leurs deux petits, Inès et la petite Lou).
import { useState } from 'react'
import { encodeLook, randomLook } from '../lib/look'
import { useHome } from '../lib/store'
import type { Member } from '../lib/types'
import { ProfilePicker } from './pickers'
import { Btn, Sheet } from './ui'

export type Petit = { m?: Member; name: string; avatar: string; color: string }

/** Un petit qui arrive : une figurine d'enfant, prénom à donner. */
export const nouveauPetit = (): Petit => ({ name: '', avatar: encodeLook({ ...randomLook(), a: 3, p: 1, h: 12, g: 0, b: 0, m: 0, l: 0 }), color: 'rose' })

/** Le petit d'un membre déjà là : son personnage, à modifier. */
export const petitDe = (m: Member): Petit => ({ m, name: m.display_name, avatar: m.avatar, color: m.color })

export function PetitSheet({ depart, onClose }: { depart: Petit; onClose: () => void }) {
  const { state, run } = useHome()
  const [petit, setPetit] = useState(depart)
  return (
    <Sheet
      title={petit.m ? petit.m.display_name : 'Un enfant ou un bébé'}
      onClose={onClose}
      tall
      footer={
        <Btn
          disabled={!petit.name.trim()}
          onClick={async () => {
            const ok = petit.m
              ? await run((a) => a.updateMember(petit.m!.id, { display_name: petit.name.trim(), avatar: petit.avatar, color: petit.color }), 'Personnage mis à jour')
              : await run((a) => a.addChild(state.family.id, { displayName: petit.name, avatar: petit.avatar, color: petit.color }), `${petit.name.trim()} arrive dans la maison`)
            if (ok) onClose()
          }}
        >
          {petit.m ? 'Enregistrer' : 'Ajouter à la maison'}
        </Btn>
      }
    >
      {!petit.m && <p className="-mt-1 mb-3 text-center text-sous text-brume">Il ou elle vivra dans le jardin avec vous ; la famille donnera son humeur et lui enverra des câlins.</p>}
      <ProfilePicker
        name={petit.name}
        setName={(v) => setPetit((x) => ({ ...x, name: v }))}
        avatar={petit.avatar}
        setAvatar={(v) => setPetit((x) => ({ ...x, avatar: v }))}
        color={petit.color}
        setColor={(v) => setPetit((x) => ({ ...x, color: v }))}
        placeholder="Son prénom"
        owned={state.owned}
      />
    </Sheet>
  )
}
