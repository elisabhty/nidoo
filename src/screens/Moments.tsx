import { Camera, ChevronLeft, Ellipsis, Folder as FolderIcon, FolderPlus, Lock, PenLine, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { ComposeSheet } from '../components/sheets'
import { Art, Avatar, Btn, choisir, confirmer, Rond, Screen, Segments, Sheet, Switch, Vide } from '../components/ui'
import { REACTIONS } from '../lib/data'
import { select, success } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Folder, Moment } from '../lib/types'
import { ago, shared } from '../lib/util'

// ───────── Un moment (photo ou petit mot) ─────────

function Carte({ mo }: { mo: Moment }) {
  const { state, run } = useHome()
  const { me, members, reactions, folders } = state
  const by = members.find((m) => m.id === mo.member_id)
  if (!by) return null
  const rs = reactions.filter((r) => r.moment_id === mo.id)
  const mine = rs.find((r) => r.member_id === me.id)?.emoji
  const folder = folders.find((f) => f.id === mo.folder_id)

  const menu = async () => {
    const targets = folders.filter((f) => f.id !== mo.folder_id)
    const actions = [
      ...targets.map((f) => ({ label: `Ranger dans « ${f.name} »` })),
      ...(folder ? [{ label: `Sortir de « ${folder.name} »` }] : []),
      { label: 'Supprimer le moment', destructive: true },
    ]
    const i = await choisir({ actions })
    if (i < 0) return
    if (i < targets.length) return run((api) => api.moveMoment(mo.id, targets[i].id), `Rangé dans ${targets[i].name}`)
    if (folder && i === targets.length) return run((api) => api.moveMoment(mo.id, null), 'Remis dans le fil de la famille')
    if (await confirmer({ title: 'Ce moment sera supprimé pour tout le monde.', confirm: 'Supprimer', destructive: true })) return run((api) => api.deleteMoment(mo), 'Moment supprimé')
  }

  return (
    <article className="groupe mx-4 shadow-carte">
      <header className="flex items-center gap-3 py-3 pl-3.5 pr-2">
        <Avatar m={by} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-appel font-semibold">{by.id === me.id ? 'Moi' : by.display_name}</p>
          <p className="flex items-center gap-1 truncate text-note text-brume">
            {ago(mo.created_at)}
            {mo.challenge ? ' · Défi photo' : ''}
            {folder && (
              <>
                {' · '}
                {folder.is_private && <Lock size={11} strokeWidth={2.6} />}
                {folder.name}
              </>
            )}
          </p>
        </div>
        {by.id === me.id ? (
          <button onClick={menu} className="presse flex h-11 w-11 items-center justify-center text-brume" aria-label="Options du moment">
            <Ellipsis size={20} />
          </button>
        ) : (
          <span className="w-3" />
        )}
      </header>
      {mo.image_url && <img src={mo.image_url} alt={mo.body ?? `Photo de ${by.display_name}`} loading="lazy" className="max-h-[70vh] w-full object-cover" />}
      {mo.challenge && <p className="px-4 pt-3 text-note font-semibold text-peche-fonce">{mo.challenge}</p>}
      {mo.body && <p className={mo.image_url ? 'px-4 pt-2.5 text-appel' : 'px-4 pb-1 font-rond text-titre3 font-medium'}>{mo.body}</p>}
      {folder?.is_private ? (
        <div className="h-3.5" />
      ) : (
        <div className="flex gap-1.5 px-3 pb-3 pt-3">
          {REACTIONS.map((r) => {
            const n = rs.filter((x) => x.emoji === r.key).length
            const on = mine === r.key
            return (
              <button
                key={r.key}
                onClick={() => {
                  select()
                  void run((api) => api.react(mo, me.id, on ? null : r.key))
                }}
                aria-pressed={on}
                aria-label={r.label}
                className={`presse flex h-9 items-center gap-1 rounded-full px-2 ${on ? 'bg-teinte-doux ring-[1.5px] ring-teinte' : 'bg-remplissage'} ${!n && !on ? 'opacity-60' : ''}`}
              >
                <Art name={r.art} size={22} />
                {n > 0 && <span className={`pr-0.5 text-note font-semibold ${on ? 'text-teinte-fonce' : 'text-encre'}`}>{n}</span>}
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}

// ───────── Créer ou régler un dossier ─────────

function FolderSheet({ folder, onClose, onDeleted }: { folder?: Folder; onClose: () => void; onDeleted?: () => void }) {
  const { state, run } = useHome()
  const [name, setName] = useState(folder?.name ?? '')
  const [priv, setPriv] = useState(folder?.is_private ?? false)
  const others = folder ? state.moments.filter((m) => m.folder_id === folder.id && m.member_id !== state.me.id).length : 0

  const save = async () => {
    if (folder && folder.is_private && !priv) {
      const ok = await confirmer({ title: 'Partager ce dossier ?', message: 'Toute la famille verra ce qu’il contient.', confirm: 'Partager avec la famille' })
      if (!ok) return
    }
    const ok = folder
      ? await run((api) => api.updateFolder(folder.id, { name: name.trim(), is_private: priv }), 'Dossier mis à jour')
      : await run((api) => api.createFolder(state.family.id, state.me.id, name, priv), priv ? 'Dossier privé créé' : 'Dossier créé pour la famille')
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet title={folder ? 'Réglages du dossier' : 'Nouveau dossier'} onClose={onClose}>
      <div className="groupe">
        <input className="h-[52px] w-full border-b border-trait bg-transparent px-4 text-corps outline-none placeholder:text-pale" placeholder="Nom du dossier" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!folder} />
        <div className="flex min-h-[56px] items-center gap-3 px-4">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-teinte text-white">
            {priv ? <Lock size={16} strokeWidth={2.4} /> : <UsersRound size={16} strokeWidth={2.4} />}
          </span>
          <span className="flex-1 text-corps">Dossier privé</span>
          <Switch on={priv} onChange={setPriv} label="Dossier privé" />
        </div>
      </div>
      <p className="px-4 pt-2 text-note text-brume">
        {priv
          ? `Toi seulement. Personne d’autre dans la famille ne voit ce dossier ni ce qu’il contient.${others ? ` Les ${others} moments ajoutés par d’autres retourneront dans le fil.` : ''}`
          : 'Toute la famille le voit et peut y ajouter des photos.'}
      </p>
      <Btn className="mt-4" onClick={save} disabled={!name.trim()}>{folder ? 'Enregistrer' : 'Créer le dossier'}</Btn>
      {folder && (
        <Btn
          kind="gris"
          className="mt-2 !text-rouge"
          onClick={async () => {
            const ok = await confirmer({
              title: `Supprimer « ${folder.name} » ?`,
              message: folder.is_private ? 'Ses photos et ses mots seront supprimés définitivement.' : 'Ses photos et ses mots retourneront dans le fil de la famille.',
              confirm: 'Supprimer le dossier',
              destructive: true,
            })
            if (ok && (await run((api) => api.deleteFolder(folder.id), 'Dossier supprimé'))) {
              onClose()
              onDeleted?.()
            }
          }}
        >
          Supprimer le dossier
        </Btn>
      )}
    </Sheet>
  )
}

// ───────── L'onglet ─────────

export default function Moments() {
  const { state } = useHome()
  const [seg, setSeg] = useState<'fil' | 'dossiers'>('fil')
  const [compose, setCompose] = useState<null | 'photo' | 'mot'>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [edit, setEdit] = useState<null | 'nouveau' | 'reglages'>(null)
  const { me, members, moments, folders } = state
  const feed = shared(moments, folders)
  const open = folders.find((f) => f.id === openId)

  // Contenu d'un dossier
  if (open) {
    const inside = moments.filter((m) => m.folder_id === open.id)
    const owner = members.find((m) => m.id === open.owner_id)
    return (
      <>
        <Screen
          title={open.name}
          leading={
            <button onClick={() => setOpenId(null)} className="presse verre flex h-11 items-center gap-0.5 rounded-full pl-1.5 pr-3.5 text-appel font-semibold" aria-label="Retour aux dossiers">
              <ChevronLeft size={22} strokeWidth={2.4} /> Dossiers
            </button>
          }
          trailing={
            <>
              {open.owner_id === me.id && <Rond label="Réglages du dossier" onClick={() => setEdit('reglages')}><Ellipsis size={20} /></Rond>}
              <Rond label="Ajouter au dossier" tint onClick={() => setCompose('photo')}><Camera size={19} /></Rond>
            </>
          }
        >
          <p className="-mt-1 mb-3 flex items-center gap-1.5 px-5 text-sous text-brume">
            {open.is_private ? <Lock size={14} strokeWidth={2.4} /> : <UsersRound size={14} strokeWidth={2.4} />}
            {open.is_private ? 'Privé, visible par toi seulement' : `Partagé avec la famille · créé par ${owner?.id === me.id ? 'toi' : (owner?.display_name ?? 'un proche')}`}
          </p>
          {inside.length === 0 ? (
            <Vide art="picto-photo" title="Dossier vide" text={open.is_private ? 'Ajoute ici ce que tu veux garder pour toi.' : 'Ajoute une photo ou un mot, toute la famille le verra ici.'}>
              <Btn onClick={() => setCompose('photo')}>Ajouter</Btn>
            </Vide>
          ) : (
            <div className="space-y-4">{inside.map((mo) => <Carte key={mo.id} mo={mo} />)}</div>
          )}
        </Screen>
        {compose && <ComposeSheet startWith={compose} folderId={open.id} onClose={() => setCompose(null)} />}
        {edit === 'reglages' && <FolderSheet folder={open} onClose={() => setEdit(null)} onDeleted={() => setOpenId(null)} />}
      </>
    )
  }

  return (
    <>
      <Screen
        title="Moments"
        trailing={
          seg === 'fil' ? (
            <>
              <Rond label="Écrire un petit mot" onClick={() => setCompose('mot')}><PenLine size={19} /></Rond>
              <Rond label="Photo surprise" tint onClick={() => setCompose('photo')}><Camera size={19} /></Rond>
            </>
          ) : (
            <Rond label="Nouveau dossier" tint onClick={() => setEdit('nouveau')}><FolderPlus size={19} /></Rond>
          )
        }
      >
        <p className="-mt-1 px-5 text-sous text-brume">Les photos et les petits mots partagés par la famille.</p>
        <div className="mx-4 mb-4 mt-3">
          <Segments value={seg} onChange={setSeg} options={[{ key: 'fil', label: 'Fil de la famille' }, { key: 'dossiers', label: 'Dossiers' }]} />
        </div>

        {seg === 'fil' ? (
          feed.length === 0 ? (
            <Vide art="picto-photo" title="Le fil est encore vide" text="Une photo de ton café, de ta vue, de ta tête : c’est souvent ce qui fait le plus plaisir.">
              <Btn onClick={() => setCompose('photo')}>Photo surprise</Btn>
            </Vide>
          ) : (
            <div className="space-y-4">{feed.map((mo) => <Carte key={mo.id} mo={mo} />)}</div>
          )
        ) : folders.length === 0 ? (
          <Vide art="picto-cadeau" title="Aucun dossier" text="Range vos souvenirs par thème. Un dossier peut être partagé avec la famille, ou privé et visible par toi seulement.">
            <Btn onClick={() => setEdit('nouveau')}>Nouveau dossier</Btn>
          </Vide>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4">
            {folders.map((f) => {
              const inside = moments.filter((m) => m.folder_id === f.id)
              const cover = inside.find((m) => m.image_url)?.image_url
              return (
                <button key={f.id} onClick={() => setOpenId(f.id)} className="presse groupe text-left shadow-carte">
                  <div className={`relative flex aspect-[4/3] items-center justify-center ${f.is_private ? 'bg-teinte-doux' : 'bg-peche-doux'}`}>
                    {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <FolderIcon size={40} strokeWidth={1.6} className={f.is_private ? 'text-teinte' : 'text-peche'} />}
                    <span className="verre absolute left-2 top-2 flex h-6 items-center gap-1 rounded-full px-2 text-mini font-semibold">
                      {f.is_private ? <Lock size={11} strokeWidth={2.6} /> : <UsersRound size={11} strokeWidth={2.6} />}
                      {f.is_private ? 'Privé' : 'Famille'}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="truncate text-appel font-semibold">{f.name}</p>
                    <p className="text-note text-brume">{inside.length} {inside.length > 1 ? 'éléments' : 'élément'}</p>
                  </div>
                </button>
              )
            })}
            <button onClick={() => setEdit('nouveau')} className="presse flex aspect-[4/3.9] flex-col items-center justify-center gap-2 rounded-groupe border-[1.5px] border-dashed border-pale text-brume">
              <FolderPlus size={28} strokeWidth={1.8} />
              <span className="text-sous font-medium">Nouveau dossier</span>
            </button>
          </div>
        )}
      </Screen>
      {compose && <ComposeSheet startWith={compose} onClose={() => setCompose(null)} />}
      {edit === 'nouveau' && <FolderSheet onClose={() => setEdit(null)} />}
    </>
  )
}
