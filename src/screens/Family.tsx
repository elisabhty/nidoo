import { Baby, Check, CircleHelp, Clock, Copy, Crown, House as HouseIcon, LogOut, Mail, Pencil, Plus, RefreshCw, Share, ShieldCheck, Trash2, UserRound, Volume2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import House from '../components/House'
import { careFor, careTodo, gardenKeys } from '../components/care'
import { DrawingsSheet, DrawingWidget } from '../components/drawing'
import { DrawSheet } from '../components/planche'
import { EventIcon, MoodSheet } from '../components/sheets'
import { JoinRequests } from '../components/requests'
import { Art, Avatar, Btn, choisir, confirmer, Rond, Row, Screen, Section, Segments, Sheet, Switch, ChampRequis, CHAMP_REQUIS } from '../components/ui'
import { CARE, DECOS, moodOf, PLAN_LIMITS } from '../lib/data'
import { select } from '../lib/haptic'
import { activerSons, jouer, sonsActives } from '../lib/sons'
import { copy, shareInvite } from '../lib/share'
import { useHome } from '../lib/store'
import type { Drawing, HouseType, Member } from '../lib/types'
import { AGES, encodeLook, lookOf, randomLook } from '../lib/look'
import { dayLabel, errorText, familyLabel, isToday, timeLabel } from '../lib/util'
import { upcoming } from './Home'
import { HousePicker, ProfilePicker } from '../components/pickers'
import Onboarding from './Onboarding'

type Open = null | 'profil' | 'maison' | 'plus' | 'compte' | 'ajouter'

/** Taille des widgets iOS : petit 158 × 158, moyen 338 × 158, grand 338 × 354. */
function Tuile({ title, hint, locked, wide, large, children }: { title: string; hint?: string; locked?: boolean; wide?: boolean; large?: boolean; children: ReactNode }) {
  return (
    <div className={`${wide || large ? 'w-[338px]' : 'w-[158px]'} shrink-0`}>
      <div className={`relative ${large ? 'h-[354px]' : 'h-[158px]'} overflow-hidden rounded-[26px] bg-carte shadow-carte`}>
        {children}
        {locked && (
          <span className="verre absolute right-2.5 top-2.5 flex h-6 items-center gap-1 rounded-full px-2 text-mini font-semibold text-encre">
            <Crown size={11} strokeWidth={2.6} /> Famille+
          </span>
        )}
      </div>
      <p className="mt-2 text-center text-note font-semibold text-encre">{title}</p>
      {hint && <p className="mt-0.5 text-center text-mini leading-snug text-brume">{hint}</p>}
    </div>
  )
}

function Widgets({ onDraw, onOpen }: { onDraw: () => void; onOpen: (d: Drawing) => void }) {
  const { state } = useHome()
  const { family, members, me } = state
  const free = family.plan === 'free'
  const next = upcoming(state.events, 2)
  const todo = state.items.filter((i) => i.kind === 'tache' && !i.done).slice(0, 3)
  const word = state.thoughts.find((t) => t.to_member === me.id)
  const from = word && members.find((m) => m.id === word.from_member)
  // La maison du widget : chacun avec son humeur du jour, comme sur l'accueil.
  const people = members.map((m) => ({ m, mood: isToday(m.mood_at) ? m.mood : null, label: m.display_name, me: m.id === me.id }))
  const shared = members.filter((m) => isToday(m.mood_at)).length
  const garden = careTodo(gardenKeys(state.houseItems, state.pet), state.cares)
  const photos = [
    ...state.moments.filter((m) => m.image_url).map((m) => ({ at: m.created_at, url: m.image_url! })),
    ...state.drawings.filter((d) => !d.to_member && d.photo_url).map((d) => ({ at: d.created_at, url: d.photo_url! })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)
    .map((x) => x.url)

  return (
    <>
    <p className="mb-2 px-5 text-note font-semibold text-brume">Petits et moyens · fais glisser pour tous les voir</p>
    <div className="no-bar flex items-start gap-3.5 overflow-x-auto px-4 pb-2">
      <Tuile title="Notre maison · moyen" hint="La maison et l’humeur de chacun" wide>
        <House type={family.house_type} items={state.houseItems} people={people} cares={state.cares} since={state.houseSince} pet={state.pet} plots={state.plots} gold={state.owned.includes('gamelle:or')} ratio={338 / 158} className="h-full" />
      </Tuile>
      <Tuile title="Créer une attention · moyen" hint="La dernière attention reçue ; touche-le pour en créer une" wide>
        <DrawingWidget compact onOpen={onOpen} onDraw={onDraw} />
      </Tuile>
      <Tuile title="À venir · petit" hint="Les deux prochains moments de l’agenda" locked={free}>
        <div className="flex h-full flex-col justify-start gap-2 p-3.5">
          <p className="text-mini font-semibold uppercase tracking-wide text-rouge">À venir</p>
          {next.length ? (
            next.map(({ e, at }) => (
              <div key={e.id} className="flex items-center gap-2">
                <EventIcon event={e} size={24} />
                <div className="min-w-0">
                  <p className="truncate text-note font-semibold">{e.title}</p>
                  <p className="text-mini text-brume">
                    {dayLabel(at)}
                    {e.all_day ? '' : ` · ${timeLabel(at)}`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-note text-brume">Rien de prévu</p>
          )}
        </div>
      </Tuile>
      <Tuile title="À faire · petit" hint="Ce qu’il reste à faire" locked={free}>
        <div className="flex h-full flex-col justify-start gap-2 p-3.5">
          <p className="text-mini font-semibold uppercase tracking-wide text-teinte">À faire</p>
          {todo.length ? (
            todo.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <span className="h-[15px] w-[15px] shrink-0 rounded-full border-[1.5px] border-pale" />
                <span className="truncate text-note font-medium">{i.title}</span>
              </div>
            ))
          ) : (
            <p className="text-note text-brume">Tout est fait</p>
          )}
        </div>
      </Tuile>
      <Tuile title="Attention reçue · petit" hint="Qui pense à toi aujourd’hui" locked={free}>
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-teinte-doux to-peche-doux p-3 text-center">
          <Art name="geste-coeur" size={62} className="anim-bat" />
          <p className="mt-2 text-note font-semibold leading-tight">{from ? `${from.display_name} pense à toi` : 'Une attention à découvrir'}</p>
        </div>
      </Tuile>
    </div>
    <p className="mb-2 mt-4 px-5 text-note font-semibold text-brume">En grand</p>
    <div className="flex justify-center px-4">
      <Tuile title="Notre maison · grand" hint="La maison, les photos du fil, les étoiles et ce que le jardin attend" large>
        <div className="flex h-full flex-col">
          <House type={family.house_type} items={state.houseItems} people={people} cares={state.cares} since={state.houseSince} pet={state.pet} plots={state.plots} gold={state.owned.includes('gamelle:or')} photos={photos} />
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-rond text-titre3">{familyLabel(family.name)}</p>
              <span className="flex shrink-0 items-center gap-1 text-note font-semibold text-brume">
                <Art name="picto-etoile" size={15} /> {family.stars}
              </span>
            </div>
            <p className="truncate text-note text-brume">
              {shared === members.length ? 'Tout le monde a partagé son humeur' : `${shared} sur ${members.length} ont partagé leur humeur`}
            </p>
            <p className={`truncate text-note font-semibold ${garden.length ? 'text-peche-fonce' : 'text-vert'}`}>
              {garden.length ? garden.map((k) => careFor(k, state.pet).need).join(' · ') : state.pet || state.houseItems.some((k) => CARE[k]) ? 'Tout le jardin est nourri et arrosé' : next[0] ? `${next[0].e.title} · ${dayLabel(next[0].at).toLowerCase()}` : 'Une belle journée à la maison'}
            </p>
          </div>
        </div>
      </Tuile>
    </div>
    </>
  )
}

export default function Family({ onGuide }: { onGuide: () => void }) {
  const { state, run, api, circles, open, toast, requests, reload } = useHome()
  const { family, me, members } = state
  const [sheet, setSheet] = useState<Open>(null)
  const [dessin, setDessin] = useState<{ to: string | null } | null>(null)
  const [dessins, setDessins] = useState<Drawing | null>(null)
  const [name, setName] = useState(me.display_name)
  const [avatar, setAvatar] = useState(me.avatar)
  const [color, setColor] = useState(me.color)
  const [famName, setFamName] = useState(family.name)
  const [houseType, setHouseType] = useState<HouseType>(family.house_type)
  const [email, setEmail] = useState('')
  const [linked, setLinked] = useState<string | null>(null)
  const [period, setPeriod] = useState<'an' | 'mois'>('an')
  const limit = PLAN_LIMITS[family.plan]
  const allDecos = state.houseItems.length >= DECOS.length

  useEffect(() => {
    api.accountEmail().then(setLinked).catch(() => undefined)
  }, [api])
  useEffect(() => {
    setName(me.display_name)
    setAvatar(me.avatar)
    setColor(me.color)
    setFamName(family.name)
    setHouseType(family.house_type)
  }, [me.id, me.display_name, me.avatar, me.color, family.name, family.house_type])

  const admin = me.role === 'responsable'
  const admins = members.filter((m) => m.role === 'responsable')
  const expired = new Date(family.invite_expires_at).getTime() < Date.now()
  const until = new Date(family.invite_expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const whoAccepts =
    admins.length === 1
      ? admins[0].id === me.id
        ? 'C’est toi qui acceptes chaque nouvelle personne.'
        : `${admins[0].display_name} accepte chaque nouvelle personne.`
      : `Les responsables (${admins.map((m) => (m.id === me.id ? 'toi' : m.display_name)).join(', ')}) acceptent chaque nouvelle personne.`

  const invite = async () => {
    let code = family.invite_code
    if (expired) {
      if (!admin) {
        toast('Le code a expiré : demande à un responsable d’en créer un nouveau.', 'err')
        return
      }
      // Code expiré : on en crée un neuf avant de le partager.
      try {
        await api.renewInvite(family.id)
        code = (await api.circles()).find((c) => c.family.id === family.id)?.family.invite_code ?? code
        await reload()
      } catch (e) {
        toast(errorText(e), 'err')
        return
      }
    }
    const r = await shareInvite(family.name, code)
    if (r === 'copie') toast('Invitation copiée')
  }

  const renew = async () => {
    const ok = await confirmer({ title: 'Créer un nouveau code ?', message: 'L’ancien code ne marchera plus. Le nouveau reste valable 7 jours.', confirm: 'Nouveau code' })
    if (ok) void run((a) => a.renewInvite(family.id), 'Nouveau code créé')
  }

  const [section, setSection] = useState<'proches' | 'maison' | 'reglages'>('proches')
  const [petit, setPetit] = useState<null | { m?: Member; name: string; avatar: string; color: string }>(null)
  const [humeurDe, setHumeurDe] = useState<Member | null>(null)

  // Un enfant ou un bébé sans téléphone : tout le monde peut donner son humeur ou changer son personnage.
  const manageKid = async (m: Member) => {
    const canRemove = admin || m.managed_by === me.id
    const actions = [
      { label: 'Donner son humeur du jour', go: () => setHumeurDe(m) },
      { label: 'Modifier son personnage', go: () => setPetit({ m, name: m.display_name, avatar: m.avatar, color: m.color }) },
      ...(canRemove
        ? [
            {
              label: 'Retirer de la maison',
              destructive: true,
              go: async () => {
                const ok = await confirmer({ title: `Retirer ${m.display_name} de la maison ?`, message: 'Son personnage quittera le jardin.', confirm: 'Retirer', destructive: true })
                if (ok) void run((a) => a.removeMember(m.id), `${m.display_name} a quitté la maison`)
              },
            },
          ]
        : []),
    ]
    const i = await choisir({ title: m.display_name, message: 'Sans téléphone : la famille donne son humeur et lui fait des câlins.', actions })
    if (i >= 0) void actions[i].go()
  }

  const manage = async (m: Member) => {
    if (!m.user_id) return manageKid(m)
    const boss = m.role === 'responsable'
    const i = await choisir({
      title: m.display_name,
      message: boss ? 'Responsable : accepte les nouveaux venus et gère le code d’invitation.' : 'Membre de la famille.',
      actions: [{ label: boss ? 'Retirer le rôle de responsable' : 'Nommer responsable' }, { label: 'Retirer de la famille', destructive: true }],
    })
    if (i === 0) void run((a) => a.setRole(m.id, boss ? 'membre' : 'responsable'), boss ? `${m.display_name} n’est plus responsable` : `${m.display_name} est maintenant responsable`)
    if (i === 1) {
      const ok = await confirmer({
        title: `Retirer ${m.display_name} de la famille ?`,
        message: 'Cette personne ne verra plus rien de la maison, et ses photos et messages seront retirés. Pour revenir, elle devra refaire une demande.',
        confirm: 'Retirer',
        destructive: true,
      })
      if (ok) void run((a) => a.removeMember(m.id), `${m.display_name} a été retiré de la famille`)
    }
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
      <Screen title="Notre famille" trailing={<Rond label="Inviter un proche" tint onClick={invite}><Share size={18} strokeWidth={2.4} /></Rond>}>
        <p className="px-5 pb-5 text-sous text-brume">Votre cercle, votre maison, vos habitudes.</p>

        <div className="mx-5 mb-5"><Segments value={section} onChange={setSection} options={[{key:'proches',label:'Mes proches'},{key:'maison',label:'La maison'},{key:'reglages',label:'Réglages'}]} /></div>
        {section === 'reglages' && api.mode === 'local' && (
          <div className="mx-4 mb-3 mt-1 rounded-[16px] bg-peche-doux px-4 py-3">
            <p className="text-note">
              <span className="font-semibold">Mode démo.</span> Cette maison vit uniquement sur cet appareil, avec des proches fictifs pour essayer.
            </p>
            {api.demoDecos && (
              <button
                onClick={() => run((a) => a.demoDecos!(family.id, !allDecos), allDecos ? 'Maison remise à zéro' : 'Toutes les décorations sont installées')}
                className="presse mt-2.5 h-9 rounded-full bg-white px-4 text-sous font-semibold text-peche-fonce"
              >
                {allDecos ? 'Remettre la maison à zéro' : 'Débloquer toutes les décorations'}
              </button>
            )}
          </div>
        )}

        {section === 'proches' && <>
        {state.requests.length > 0 && (
          <>
            <p className="entete mt-2">{state.requests.length > 1 ? `${state.requests.length} demandes pour entrer` : 'Une demande pour entrer'}</p>
            <JoinRequests className="mb-6" />
          </>
        )}

        <div className="groupe mx-4 mt-1 shadow-carte">
          <div className="flex items-center gap-3 border-b border-trait p-3.5">
            <div className="h-[58px] w-[76px] shrink-0 overflow-hidden rounded-[14px]">
              <House type={family.house_type} items={[]} className="h-full !aspect-auto" bare />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-rond text-titre3">{familyLabel(family.name)}</p>
              <p className="text-note text-brume">
                {members.filter((m) => m.user_id).length} membres avec l’appli (jusqu’à {limit}){members.some((m) => !m.user_id) ? `, ${members.filter((m) => !m.user_id).length} sans téléphone` : ''} · offre {family.plan === 'plus' ? 'Famille+' : 'gratuite'}
              </p>
            </div>
            <button onClick={() => setSheet('maison')} className="presse flex h-9 w-9 items-center justify-center rounded-full bg-remplissage text-teinte" aria-label="Modifier la maison">
              <Pencil size={16} strokeWidth={2.4} />
            </button>
          </div>
          {members.map((m, i) => (
            <button
              key={m.id}
              disabled={!!m.user_id && !admin && m.id !== me.id}
              onClick={() => {
                select()
                if (m.id === me.id) setSheet('profil')
                else void manage(m)
              }}
              className={`flex w-full items-center gap-3 pl-3.5 text-left ${(admin && m.id !== me.id) || !m.user_id ? 'presse-ligne' : ''}`}
              aria-label={(admin && m.id !== me.id) || !m.user_id ? `Gérer ${m.display_name}` : undefined}
            >
              <Avatar m={m} size={42} mood />
              <div className="min-w-0 flex-1 border-b border-trait py-2.5 pr-4">
                <p className="flex items-center gap-1.5 truncate text-corps">
                  <span className="truncate">
                    {m.display_name}
                    {m.id === me.id && <span className="text-brume"> (toi)</span>}
                  </span>
                  {!m.user_id && (
                    <span className="flex h-5 shrink-0 items-center rounded-full bg-peche-doux px-1.5 text-mini font-semibold text-peche-fonce">
                      {AGES[lookOf(m.avatar, m.id).a]} · sans téléphone
                    </span>
                  )}
                  {m.role === 'responsable' && m.user_id && (
                    <span className="flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-teinte-doux px-1.5 text-mini font-semibold text-teinte-fonce">
                      <ShieldCheck size={11} strokeWidth={2.6} /> Responsable
                    </span>
                  )}
                </p>
                <p className="truncate text-note text-brume">
                  {isToday(m.mood_at) && moodOf(m.mood) ? `${moodOf(m.mood)!.label}${m.mood_note ? ` · ${m.mood_note}` : ''}` : 'Pas encore d’humeur aujourd’hui'}
                </p>
              </div>
            </button>
          ))}
          <button
            onClick={() => {
              select()
              setPetit({ name: '', avatar: encodeLook({ ...randomLook(), a: 3, p: 1, h: 12, g: 0, b: 0, m: 0, l: 0 }), color: 'rose' })
            }}
            className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left"
          >
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-peche-doux text-peche-fonce">
              <Baby size={21} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1 py-3 pr-4">
              <span className="block text-corps text-teinte">Ajouter un enfant ou un bébé</span>
              <span className="block truncate text-note text-brume">Pour les petits qui n’ont pas de téléphone</span>
            </span>
          </button>
        </div>

        <p className="entete mt-6">Inviter un proche</p>
        <div className="groupe mx-4 shadow-carte">
          <button
            disabled={expired}
            onClick={async () => (await copy(family.invite_code)) && toast('Code copié')}
            className="presse-ligne flex min-h-[64px] w-full items-center justify-between border-b border-trait px-4 py-2 text-left"
            aria-label={`Copier le code ${family.invite_code}`}
          >
            <span>
              <span className={`block font-rond text-titre2 tracking-[0.18em] ${expired ? 'text-pale line-through' : ''}`}>{family.invite_code}</span>
              <span className={`block text-note ${expired ? 'font-semibold text-rouge' : 'text-brume'}`}>{expired ? 'Code expiré' : `Valable jusqu’au ${until}`}</span>
            </span>
            {!expired && <Copy size={18} className="text-teinte" />}
          </button>
          <button onClick={invite} className={`presse-ligne flex h-[50px] w-full items-center px-4 text-corps text-teinte ${admin ? 'border-b border-trait' : ''}`}>
            {expired && admin ? 'Créer un code et partager' : 'Partager le lien d’invitation'}
          </button>
          {admin && (
            <button onClick={renew} className="presse-ligne flex h-[50px] w-full items-center gap-2 px-4 text-corps text-encre">
              <RefreshCw size={16} strokeWidth={2.4} className="text-brume" /> Changer le code
            </button>
          )}
        </div>
        <p className="flex gap-1.5 px-8 pt-2 text-note text-brume">
          <ShieldCheck size={15} strokeWidth={2.4} className="mt-[1px] shrink-0 text-teinte" />
          <span>Le code permet seulement de demander à entrer. {whoAccepts}{admin ? ' Touche un membre pour nommer un autre responsable ou le retirer.' : ''}</span>
        </p>

        </>}
        {section === 'maison' && <>
        <Section title="Widgets">
          <p className="-mt-1.5 mb-3 px-5 text-sous text-brume">Les widgets montrent la famille sur l’écran d’accueil de l’iPhone, sans ouvrir l’appli. Voici leur aperçu, à jour en direct.</p>
          <Widgets onDraw={() => setDessin({ to: null })} onOpen={(d) => setDessins(d)} />
        </Section>

        <button onClick={() => setSheet('plus')} className="presse mx-4 mt-6 flex w-[calc(100%-2rem)] items-center gap-3 overflow-hidden rounded-groupe p-3.5 text-left text-white shadow-flottant" style={{ background: 'linear-gradient(135deg, #8E6FF0 0%, #6646CC 100%)' }}>
          <Art name="picto-couronne" size={50} />
          <span className="min-w-0 flex-1">
            <span className="block font-rond text-titre3">NIDOO Famille+</span>
            <span className="block text-note text-white/80">15 membres, tous les widgets, plusieurs maisons</span>
          </span>
          <span className="flex h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-sous font-semibold text-teinte-fonce">Voir</span>
        </button>

        <p className="entete mt-7">Mes maisons</p>
        <div className="groupe mx-4 shadow-carte">
          {circles.map((c) => (
            <Row
              key={c.family.id}
              icon={<HouseIcon size={17} strokeWidth={2.4} />}
              tint="#F58B5C"
              label={familyLabel(c.family.name)}
              chevron={false}
              value={c.family.id === family.id ? <Check size={19} strokeWidth={2.8} className="text-teinte" /> : undefined}
              onClick={() => {
                select()
                if (c.family.id !== family.id) void open(c.family.id)
              }}
            />
          ))}
          {requests.map((r) => (
            <Row
              key={r.id}
              icon={<Clock size={17} strokeWidth={2.4} />}
              tint={r.status === 'refusee' ? '#FF3B30' : '#8E8E93'}
              label={familyLabel(r.family_name)}
              value={r.status === 'refusee' ? 'Refusée' : 'En attente'}
              chevron={false}
              onClick={async () => {
                const ok = await confirmer(
                  r.status === 'refusee'
                    ? { title: `« ${familyLabel(r.family_name)} » n’a pas accepté ta demande.`, confirm: 'Effacer' }
                    : { title: `Annuler ta demande pour « ${familyLabel(r.family_name)} » ?`, confirm: 'Annuler la demande', destructive: true },
                )
                if (ok) void run((a) => a.cancelRequest(r.id))
              }}
            />
          ))}
          <Row icon={<Plus size={18} strokeWidth={2.6} />} tint="#34C759" label="Ajouter une maison" onClick={() => setSheet('ajouter')} last />
        </div>
        <p className="px-8 pt-2 text-note text-brume">Chaque maison garde ses photos et ses informations séparées.</p>

        </>}
        {section === 'reglages' && <>
        <p className="entete mt-6">Réglages</p>
        <div className="groupe mx-4 shadow-carte">
          <Row icon={<CircleHelp size={17} strokeWidth={2.4} />} tint="#F58B5C" label="Comment ça marche" onClick={onGuide} />
          <SonsRow />
          <Row icon={<UserRound size={17} strokeWidth={2.4} />} label="Mon personnage" value={me.display_name} onClick={() => setSheet('profil')} last={api.mode !== 'supabase'} />
          {api.mode === 'supabase' && <Row icon={<Mail size={16} strokeWidth={2.4} />} tint="#5AA3E0" label="Sauvegarder mon compte" value={linked ? 'Activé' : undefined} onClick={() => setSheet('compte')} last />}
        </div>
        <div className="groupe mx-4 mt-5 shadow-carte">
          <Row
            icon={<LogOut size={16} strokeWidth={2.4} />}
            danger
            label="Quitter cette maison"
            chevron={false}
            onClick={async () =>
              (await confirmer({ title: `Quitter « ${familyLabel(family.name)} » ?`, message: 'Tes photos et tes messages y seront retirés.', confirm: 'Quitter la maison', destructive: true })) && run((a) => a.leave(me.id))
            }
          />
          <Row
            icon={<Trash2 size={16} strokeWidth={2.4} />}
            danger
            label="Supprimer mon compte"
            chevron={false}
            last
            onClick={async () => {
              const ok = await confirmer({
                title: 'Supprimer ton compte ?',
                message: 'Ton personnage, tes messages, tes photos et tes vocaux seront effacés de toutes tes maisons. Une maison où personne d’autre n’a l’appli sera supprimée avec. C’est définitif.',
                confirm: 'Supprimer définitivement',
                destructive: true,
              })
              if (!ok) return
              try {
                await api.deleteAccount()
                toast('Ton compte est supprimé')
                window.setTimeout(() => window.location.reload(), 1200) // on repart sur l'écran d'accueil
              } catch (e) {
                toast(errorText(e), 'err')
              }
            }}
          />
        </div>
        <p className="mt-6 text-center text-legende text-pale">NIDOO · sans publicité, sans revente de données</p>
        </>}
      </Screen>

      {sheet === 'profil' && (
        <Sheet title="Mon personnage" onClose={() => setSheet(null)} tall footer={<Btn disabled={!name.trim()} onClick={async () => (await run((a) => a.updateMember(me.id, { display_name: name.trim(), avatar, color }), 'Profil mis à jour')) && setSheet(null)}>Enregistrer</Btn>}>
          <ProfilePicker name={name} setName={setName} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} owned={state.owned} />
        </Sheet>
      )}

      {sheet === 'maison' && (
        <Sheet title="Notre maison" onClose={() => setSheet(null)}>
          <ChampRequis id="nom-maison-modif" label="Nom de la maison" aide="Toute la famille le voit en haut de l’accueil.">
            <input id="nom-maison-modif" required aria-describedby="nom-maison-modif-aide" className={`${CHAMP_REQUIS} font-semibold`} maxLength={40} placeholder="Notre maison" value={famName} onChange={(e) => setFamName(e.target.value)} />
          </ChampRequis>
          <HousePicker value={houseType} onChange={setHouseType} />
          <Btn className="mt-5" disabled={!famName.trim()} onClick={async () => (await run((a) => a.updateFamily(family.id, { name: famName.trim(), house_type: houseType }), 'Maison mise à jour')) && setSheet(null)}>
            Enregistrer
          </Btn>
        </Sheet>
      )}

      {sheet === 'plus' && (
        <Sheet title="Famille+" onClose={() => setSheet(null)}>
          <div className="flex flex-col items-center text-center">
            <Art name="picto-couronne" size={84} />
            <p className="mt-2 font-rond text-titre1">NIDOO Famille+</p>
            <p className="mt-1 max-w-[280px] text-sous text-brume">Une personne s’abonne, toute la maison en profite.</p>
          </div>
          <div className="groupe mt-4">
            {['Jusqu’à 15 membres dans la maison', 'Tous les widgets : À venir, À faire, Attention reçue', 'Plusieurs maisons familiales'].map((f, i, all) => (
              <div key={f} className="flex items-center gap-3 pl-4">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-teinte text-white"><Check size={13} strokeWidth={3.4} /></span>
                <span className={`flex-1 py-3 pr-4 text-appel ${i < all.length - 1 ? 'border-b border-trait' : ''}`}>{f}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {([['an', 'Annuel', '29,99 €', 'soit 2,50 € par mois'], ['mois', 'Mensuel', '3,99 €', 'pour tout le foyer']] as const).map(([k, label, price, hint]) => (
              <button
                key={k}
                onClick={() => {
                  select()
                  setPeriod(k)
                }}
                aria-pressed={period === k}
                className={`presse relative rounded-groupe bg-carte px-3 py-3.5 text-center ${period === k ? 'ring-2 ring-teinte' : ''}`}
              >
                {k === 'an' && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teinte px-2.5 py-0.5 text-mini font-semibold text-white">Le plus avantageux</span>}
                <p className="text-note font-medium text-brume">{label}</p>
                <p className="font-rond text-titre2">{price}</p>
                <p className="text-legende text-brume">{hint}</p>
              </button>
            ))}
          </div>
          <Btn className="mt-4" disabled>Bientôt disponible sur l’App Store</Btn>
          <p className="mt-2.5 text-center text-legende text-brume">Sans publicité, sans revente des données familiales.</p>
        </Sheet>
      )}

      {sheet === 'compte' && (
        <Sheet title="Sauvegarder mon compte" onClose={() => setSheet(null)}>
          <p className="text-center text-sous text-brume">
            {linked ? `Ton compte est rattaché à ${linked}.` : 'Ajoute ton e-mail pour retrouver ta maison si tu changes de téléphone. Tu recevras un lien de confirmation.'}
          </p>
          <input className="champ mt-4 !bg-carte" type="email" inputMode="email" autoCapitalize="none" placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
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
      {dessin && <DrawSheet to={dessin.to} onClose={() => setDessin(null)} />}
      {dessins && (
        <DrawingsSheet
          start={dessins}
          onClose={() => setDessins(null)}
          onDraw={(to) => {
            setDessins(null)
            setDessin({ to })
          }}
        />
      )}
      {petit && (
        <Sheet title={petit.m ? petit.m.display_name : 'Un enfant ou un bébé'} onClose={() => setPetit(null)} tall footer={<Btn
            disabled={!petit.name.trim()}
            onClick={async () => {
              const ok = petit.m
                ? await run((a) => a.updateMember(petit.m!.id, { display_name: petit.name.trim(), avatar: petit.avatar, color: petit.color }), 'Personnage mis à jour')
                : await run((a) => a.addChild(family.id, { displayName: petit.name, avatar: petit.avatar, color: petit.color }), `${petit.name.trim()} arrive dans la maison`)
              if (ok) setPetit(null)
            }}
          >
            {petit.m ? 'Enregistrer' : 'Ajouter à la maison'}
          </Btn>}>
          {!petit.m && <p className="-mt-1 mb-3 text-center text-sous text-brume">Il ou elle vivra dans le jardin avec vous ; la famille donnera son humeur et lui enverra des câlins.</p>}
          <ProfilePicker
            name={petit.name}
            setName={(v) => setPetit((x) => x && { ...x, name: v })}
            avatar={petit.avatar}
            setAvatar={(v) => setPetit((x) => x && { ...x, avatar: v })}
            color={petit.color}
            setColor={(v) => setPetit((x) => x && { ...x, color: v })}
            placeholder="Son prénom"
            owned={state.owned}
          />

        </Sheet>
      )}
      {humeurDe && <MoodSheet member={humeurDe} onClose={() => setHumeurDe(null)} />}
    </>
  )
}

/** Les sons de la maison (gestes, compagnon, jardin) : on peut les couper. */
function SonsRow() {
  const [on, setOn] = useState(sonsActives)
  return (
    <Row
      icon={<Volume2 size={17} strokeWidth={2.4} />}
      tint="#E77BA0"
      label="Sons"
      hint="Câlins, compagnon, jardin"
      value={
        <Switch
          on={on}
          label="Sons de la maison"
          onChange={(v) => {
            activerSons(v)
            setOn(v)
            if (v) jouer('geste-coeur')
          }}
        />
      }
    />
  )
}
