import type { FamilyState } from './types'

export function housePhotoSources(state: Pick<FamilyState, 'moments' | 'drawings'>) {
  return [
    ...state.moments.filter(m => m.image_url).map(m => ({id:`m:${m.id}`,url:m.image_url!,at:m.created_at})),
    ...state.drawings.filter(d => !d.to_member && d.photo_url).map(d => ({id:`d:${d.id}`,url:d.photo_url!,at:d.created_at})),
  ].sort((a,b) => b.at.localeCompare(a.at))
}

/** Une sélection vide reste vide ; seuls les profils sans choix utilisent les six dernières photos. */
export function selectedHousePhotos(sources: ReturnType<typeof housePhotoSources>, ids?: string[] | null) {
  return ids == null ? sources.slice(0,6) : [...new Set(ids)].flatMap(id => sources.find(p => p.id === id) ?? []).slice(0,6)
}
