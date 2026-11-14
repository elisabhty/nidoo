import { Check, ChevronRight, Copy, Crown, Home as HomeIcon, LogOut, Mail, Pencil, Plus, Share2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import House from '../components/House'
import { eventEmoji } from '../components/sheets'
import { Avatar, Btn, Section, Sheet } from '../components/ui'
import { HOUSES, moodOf, PLAN_LIMITS } from '../lib/data'
import { copy, shareInvite } from '../lib/share'
import { useHome } from '../lib/store'
import type { HouseType } from '../lib/types'
import { dayLabel, errorText, isToday } from '../lib/util'
import { upcoming } from './Home'
import Onboarding, { ProfilePicker } from './Onboarding'

type Open = null | 'profil' | 'maison' | 'plus' | 'compte' | 'ajouter'

function Ligne({ icon, label, hint, onClick, danger }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="appui flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-peche-100 text-peche-500' : 'bg-lavande-100 text-lavande-600'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15.5px] font-bold ${danger ? 'text-peche-500' : ''}`}>{label}</span>
        {hint && <span className="block truncate text-[13px] text-brume">{hint}</span>}
      </span>
      <ChevronRight size={18} className="text-brume/50" />
    </button>
  )
}

function Tuile({ title, locked, children }: { title: string; locked?: boolean; children: ReactNode }) {
  return (
    <div className="w-[150px] shrink-0">
      <div className="relative h-[150px] overflow-hidden rounded-[2rem] bg-white shadow-doux">
        {children}
        {locked && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-encre/85 px-2 py-1 text-[10.5px] font-extrabold text-white">
            <Crown size={11} /> Famille+
          </span>
        )}
      </div>
      <p className="mt-2 text-center text-[13.5px] font-extrabold">{title}</p>
    </div>
  )
}

function Widgets() {
  const { state } = useHome()
  const { family, members, me } = state
  const free = family.plan === 'free'
  const photo = state.moments.find((m) => m.image_url)
  const note = state.moments.find((m) => m.body)
  const next = upcoming(state.events, 2)
  const todo = state.items.filter((i) => i.kind === 'tache' && !i.done).slice(0, 3)
  const word = state.thoughts.find((t) => t.to_member === me.id)
  const from = word && members.find((m) => m.id === word.from_member)

  return (
    <div className="no-bar flex gap-3.5 overflow-x-auto px-5 pb-2">
      <Tuile title="Notre maison">
        <House type={family.house_type} members={members} items={state.houseItems} className="-mx-[22%] mt-1 w-[144%] max-w-none" />
      </Tuile>
      <Tuile title="Notre instant">
        {photo?.image_url ? (
          <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col justify-between bg-peche-100 p-3.5">
            <span className="text-[26px]">📸</span>
            <p className="line-clamp-4 font-titre text-[14.5px] font-medium leading-snug">{note?.body ?? 'La prochaine photo surprise apparaîtra ici.'}</p>
          </div>
        )}
      </Tuile>
      <Tuile title="Nos humeurs">
        <div className="grid h-full grid-cols-2 content-center gap-2 bg-lavande-50 p-3">
          {members.slice(0, 4).map((m) => (
            <div key={m.id} className="flex flex-col items-center">
              <Avatar m={m} size={40} mood />
              <span className="mt-1 w-full truncate text-center text-[10.5px] font-bold text-brume">{(isToday(m.mood_at) && moodOf(m.mood)?.label) || m.display_name}</span>
            </div>
          ))}
        </div>
      </Tuile>
      <Tuile title="À venir" locked={free}>
        <div className="flex h-full flex-col justify-center gap-2 p-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-peche-500">À venir</p>
          {next.length ? (
            next.map(({ e, at }) => (
              <div key={e.id}>
                <p className="line-clamp-1 font-titre text-[14.5px] font-semibold">{eventEmoji(e.kind)} {e.title}</p>
                <p className="text-[11.5px] text-brume">{dayLabel(at)}</p>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-brume">Rien de prévu</p>
          )}
        </div>
      </Tuile>
      <Tuile title="Nos missions" locked={free}>
        <div className="flex h-full flex-col justify-center gap-2 bg-lavande-50 p-3.5">
          {todo.length ? (
            todo.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-lavande-300" />
                <span className="truncate text-[12.5px] font-bold">{i.title}</span>
              </div>
            ))
          ) : (
            <p className="text-center text-[13px] font-bold text-brume">Tout est fait 🎉</p>
          )}
        </div>
      </Tuile>
      <Tuile title="Surprise !" locked={free}>
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-lavande-200 to-peche-100 p-3 text-center">
          <span className="anim-bat text-[40px] leading-none">💜</span>
          <p className="mt-2 text-[12.5px] font-extrabold leading-tight">{from ? `${from.display_name} pense à toi` : 'Une attention à découvrir'}</p>
        </div>
      </Tuile>
    </div>
  )
}

export default function Family() {
  const { state, run, api, circles, open, toast } = useHome()
  const { family, me, members } = state
  const [sheet, setSheet] = useState<Open>(null)
  const [name, setName] = useState(me.display_name)
  const [avatar, setAvatar] = useState(me.avatar)
  const [color, setColor] = useState(me.color)
  const [famName, setFamName] = useState(family.name)
  const [houseType, setHouseType] = useState<HouseType>(family.house_type)
  const [email, setEmail] = useState('')
  const [linked, setLinked] = useState<string | null>(null)
  const limit = PLAN_LIMITS[family.plan]

  useEffect(() => {
    api.accountEmail().then(setLinked).catch(() => undefined)
  }, [api])
  useEffect(() => {
    setName(me.display_name); setAvatar(me.avatar); setColor(me.color); setFamName(family.name); setHouseType(family.house_type)
  }, [me.id, me.display_name, me.avatar, me.color, family.name, family.house_type])

  const invite = async () => {
    const r = await shareInvite(family.name, family.invite_code)
    if (r === 'copie') toast('Invitation copiée')
  }

  if (sheet === 'ajouter') {
    return (
      <div className="absolute inset-0 z-40">
        <Onboarding onCancel={() => setSheet(null)} />
      </div>
    )
  }

  return (
    <>
      <div className="no-bar h-full overflow-y-auto pb-32" style={{ paddingTop: 'calc(var(--sat) + 14px)' }}>
        <h1 className="titre px-5 text-[32px] leading-none">Notre famille</h1>

        {api.mode === 'local' && (
          <p className="mx-5 mt-4 rounded-2xl bg-peche-100 px-4 py-3 text-[13.5px] leading-snug">
            <b>Mode démo.</b> Cette maison vit uniquement sur cet appareil, avec trois proches fictifs pour essayer.
          </p>
        )}

        <div className="carte mx-5 mt-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="titre text-[21px] leading-tight">Famille {family.name}</p>
              <p className="text-[13.5px] text-brume">{members.length} sur {limit} membres · {family.plan === 'plus' ? 'Famille+' : 'Gratuit'}</p>
            </div>
            <button onClick={() => setSheet('maison')} className="appui flex h-10 w-10 items-center justify-center rounded-full bg-lavande-100 text-lavande-600" aria-label="Modifier la maison">
              <Pencil size={17} />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar m={m} size={44} mood />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-extrabold">{m.display_name}{m.id === me.id && <span className="font-semibold text-brume"> · toi</span>}</p>
                  <p className="truncate text-[13px] text-brume">
                    {isToday(m.mood_at) && moodOf(m.mood) ? `${moodOf(m.mood)!.label}${m.mood_note ? ` · ${m.mood_note}` : ''}` : 'Pas encore de nouvelles aujourd’hui'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={async () => (await copy(family.invite_code)) && toast('Code copié')}
              className="appui flex h-[52px] items-center gap-2 rounded-full bg-lavande-100 px-4"
              aria-label={`Copier le code ${family.invite_code}`}
            >
              <span className="font-titre text-[18px] font-semibold tracking-[0.14em]">{family.invite_code}</span>
              <Copy size={15} className="text-lavande-600" />
            </button>
            <Btn onClick={invite} className="flex-1"><Share2 size={17} /> Inviter</Btn>
          </div>
        </div>

        <Section title="Widgets">
          <p className="-mt-1.5 mb-3 px-5 text-[13.5px] leading-snug text-brume">Aperçu en direct de ce que chacun verra sur son écran d’accueil.</p>
          <Widgets />
        </Section>

        <button onClick={() => setSheet('plus')} className="appui mx-5 mt-6 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-4xl bg-encre p-4 text-left text-white shadow-doux">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15"><Crown size={22} className="text-[#FFD98A]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-titre text-[18px] font-semibold">NIDOO Famille+</span>
            <span className="block text-[13.5px] text-white/75">Jusqu’à 15 membres, tous les widgets, plusieurs maisons</span>
          </span>
          <ChevronRight size={18} className="text-white/60" />
        </button>

        <Section title="Mes maisons">
          <div className="carte mx-5 divide-y divide-lavande-50">
            {circles.map((c) => (
              <button key={c.family.id} onClick={() => c.family.id !== family.id && void open(c.family.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-peche-100 text-peche-500"><HomeIcon size={18} /></span>
                <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold">Famille {c.family.name}</span>
                {c.family.id === family.id && <Check size={18} className="text-lavande-500" />}
              </button>
            ))}
            <Ligne icon={<Plus size={18} />} label="Ajouter une maison" hint="Créer ou rejoindre un autre cercle" onClick={() => setSheet('ajouter')} />
          </div>
        </Section>

        <Section title="Réglages">
          <div className="carte mx-5 divide-y divide-lavande-50">
            <Ligne icon={<span className="text-[18px]">🙂</span>} label="Mon profil" hint={me.display_name} onClick={() => setSheet('profil')} />
            {api.mode === 'supabase' && (
              <Ligne icon={<Mail size={18} />} label="Sauvegarder mon compte" hint={linked ?? 'Pour retrouver ta maison sur un autre téléphone'} onClick={() => setSheet('compte')} />
            )}
            <Ligne
              icon={<LogOut size={18} />}
              label="Quitter cette maison"
              danger
              onClick={() => window.confirm(`Quitter la maison de la famille ${family.name} ? Tes photos et messages y seront retirés.`) && run((a) => a.leave(me.id))}
            />
          </div>
        </Section>
        <p className="mt-6 text-center text-[12px] text-brume/70">NIDOO · sans publicité, sans revente de données</p>
      </div>

      {sheet === 'profil' && (
        <Sheet title="Mon profil" onClose={() => setSheet(null)}>
          <ProfilePicker name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} />
          <Btn className="mt-5" disabled={!name.trim()} onClick={async () => (await run((a) => a.updateMember(me.id, { display_name: name.trim(), avatar, color }), 'Profil mis à jour')) && setSheet(null)}>
            Enregistrer
          </Btn>
        </Sheet>
      )}

      {sheet === 'maison' && (
        <Sheet title="Notre maison" onClose={() => setSheet(null)}>
          <label className="text-[13px] font-bold text-brume">
            Nom de la famille
            <input className="champ mt-1" maxLength={32} value={famName} onChange={(e) => setFamName(e.target.value)} />
          </label>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {HOUSES.map((h) => (
              <button key={h.key} onClick={() => setHouseType(h.key)} aria-pressed={houseType === h.key} className={`appui overflow-hidden rounded-3xl border-2 bg-white pb-2 ${houseType === h.key ? 'border-lavande-400' : 'border-transparent shadow-carte'}`}>
                <div className="h-[80px] overflow-hidden">
                  <House type={h.key} members={[]} items={[]} phase="jour" className="-mx-[38%] -mt-3 w-[176%] max-w-none" />
                </div>
                <span className="mt-1 block text-[13.5px] font-extrabold">{h.label}</span>
              </button>
            ))}
          </div>
          <Btn className="mt-5" disabled={!famName.trim()} onClick={async () => (await run((a) => a.updateFamily(family.id, { name: famName.trim(), house_type: houseType }), 'Maison mise à jour')) && setSheet(null)}>
            Enregistrer
          </Btn>
        </Sheet>
      )}

      {sheet === 'plus' && (
        <Sheet title="NIDOO Famille+" onClose={() => setSheet(null)}>
          <p className="text-[14.5px] text-brume">Un seul abonnement pour tout le foyer : une personne s’abonne, toute la maison en profite.</p>
          <ul className="mt-4 space-y-2.5">
            {['Jusqu’à 15 membres dans la maison', 'Tous les widgets et tous les thèmes', 'Albums et souvenirs enrichis', 'Mini-jeux et défis exclusifs', 'Décorations premium', 'Plusieurs maisons familiales'].map((f) => (
              <li key={f} className="flex items-center gap-3 text-[15px] font-semibold">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavande-200 text-lavande-600"><Check size={14} strokeWidth={3} /></span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-3xl border-2 border-lavande-400 bg-lavande-50 p-4 text-center">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-lavande-600">Annuel</p>
              <p className="titre mt-1 text-[24px]">29,99 €</p>
              <p className="text-[12.5px] text-brume">soit 2,50 € par mois</p>
            </div>
            <div className="rounded-3xl border-2 border-transparent bg-white p-4 text-center shadow-carte">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-brume">Mensuel</p>
              <p className="titre mt-1 text-[24px]">3,99 €</p>
              <p className="text-[12.5px] text-brume">pour tout le foyer</p>
            </div>
          </div>
          <Btn className="mt-5" disabled>Disponible à la sortie sur l’App Store</Btn>
          <p className="mt-2.5 text-center text-[12.5px] text-brume">Sans publicité intrusive ni vente des données familiales.</p>
        </Sheet>
      )}

      {sheet === 'compte' && (
        <Sheet title="Sauvegarder mon compte" onClose={() => setSheet(null)}>
          <p className="text-[14.5px] leading-snug text-brume">
            {linked ? `Ton compte est rattaché à ${linked}.` : 'Ajoute ton e-mail pour retrouver ta maison si tu changes de téléphone. Tu recevras un lien de confirmation.'}
          </p>
          <input className="champ mt-4" type="email" inputMode="email" autoCapitalize="none" placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Btn
            className="mt-4"
            disabled={!/^\S+@\S+\.\S+$/.test(email)}
            onClick={async () => {
              try {
                await api.linkEmail(email.trim())
                setLinked(email.trim())
                toast('Vérifie ta boîte mail pour confirmer')
                setSheet(null)
              } catch (e) {
                toast(errorText(e), 'err')
              }
            }}
          >
            Envoyer le lien
          </Btn>
        </Sheet>
      )}
    </>
  )
}
