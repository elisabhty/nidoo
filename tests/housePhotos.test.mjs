import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {loadTs} from './loadTs.mjs'
const {housePhotoSources,selectedHousePhotos} = await loadTs('src/lib/housePhotos.ts')
const state = {
  moments:[{id:'a',image_url:'signed-old',created_at:'2026-11-18T12:00:00Z'},{id:'b',image_url:'second',created_at:'2026-11-18T11:00:00Z'}],
  drawings:[{id:'private',to_member:'someone',photo_url:'private-photo',created_at:'2026-11-18T13:00:00Z'},{id:'shared',to_member:null,photo_url:'shared-photo',created_at:'2026-11-18T10:00:00Z'}],
}
test('retirer une photo ne remplit pas sa place et ne modifie pas le fil',() => {
 const before=structuredClone(state)
 const sources=housePhotoSources(state)
 assert.deepEqual(selectedHousePhotos(sources,['m:b']).map(p=>p.id),['m:b'])
 assert.deepEqual(selectedHousePhotos(sources,[]),[])
 assert.deepEqual(state,before)
 assert.ok(!sources.some(p => p.id==='d:private'))
})
test('la sélection survit au renouvellement des liens et ignore une photo supprimée',() => {
 const fresh=structuredClone(state);fresh.moments[0].image_url='signed-new'
 assert.equal(selectedHousePhotos(housePhotoSources(fresh),['m:a'])[0].url,'signed-new')
 fresh.moments=[]
 assert.deepEqual(selectedHousePhotos(housePhotoSources(fresh),['m:a']),[])
})

test('une photo décrochée laisse sa place libre sur la corde', async () => {
  const { housePhotoSlots } = await loadTs('src/lib/housePhotos.ts')
  const sources = [
    { id: 'm:1', url: 'u1', at: '2026-11-18T10:00:00Z' },
    { id: 'm:2', url: 'u2', at: '2026-11-17T10:00:00Z' },
  ]
  assert.deepEqual(housePhotoSlots(sources, null).map((p) => p?.id ?? null), ['m:1', 'm:2'])
  assert.deepEqual(housePhotoSlots(sources, ['m:2', '', 'm:1']).map((p) => p?.id ?? null), ['m:2', null, 'm:1'])
  // une photo qui n'existe plus laisse aussi une place libre
  assert.deepEqual(housePhotoSlots(sources, ['m:9', 'm:1']).map((p) => p?.id ?? null), [null, 'm:1'])
})
