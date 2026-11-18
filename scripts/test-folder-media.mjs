import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = await mkdtemp(join(tmpdir(),'nidoo-media-test-'))
const storage = new Map()
let quota = Infinity
Object.assign(globalThis, {
  localStorage: { getItem:k => storage.get(k) ?? null, setItem:(k,v) => { if(v.length > quota) throw new Error('QuotaExceededError'); storage.set(k,v) }, removeItem:k => storage.delete(k) },
  window: { setTimeout:() => 0, clearTimeout:() => {}, setInterval:() => 0, clearInterval:() => {} },
  FileReader: class { readAsDataURL(blob) { blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload?.() }).catch(e => { this.error=e; this.onerror?.() }) } },
})
try {
  for (const [name,entry] of [['backend','src/lib/localBackend.ts'],['assets','src/lib/folderMedia.ts']]) await build({entryPoints:[join(root,entry)],outfile:join(temp,`${name}.mjs`),bundle:true,format:'esm',platform:'node',logLevel:'silent'})
  const { folderAsset } = await import(pathToFileURL(join(temp,'assets.mjs')))
  assert.equal(folderAsset('audio',new Blob(['voice'],{type:'audio/webm;codecs=opus'})).extension,'webm')
  assert.equal(folderAsset('video',new File(['clip'],'souvenir.mov')).mime,'video/quicktime')
  assert.throws(() => folderAsset('video',new Blob(['bad'],{type:'text/html'})),/FORMAT_SOUVENIR_INVALIDE/)
  assert.throws(() => folderAsset('audio',new Blob([],{type:'audio/wav'})),/FICHIER_VIDE/)
  assert.throws(() => folderAsset('video',new Blob([new Uint8Array(26*1024*1024)],{type:'video/mp4'})),/VIDEO_TROP_LOURDE/)
  console.log('PASS formats, MIME parameters, empty files and video size limit')

  const { createLocalBackend } = await import(pathToFileURL(join(temp,'backend.mjs')))
  const api = createLocalBackend()
  await api.start()
  const fid = await api.createFamily({name:'Test souvenirs',houseType:'maison',displayName:'Test',avatar:'panda',color:'lavande'})
  let state = await api.load(fid)
  const folder = state.folders[0]
  const me = state.me.id
  for (let i=0;i<8;i++) await api.postMoment(fid,me,{body:`Source du fil ${i}`})
  const originalIds = (await api.load(fid)).moments.map(m=>m.id).sort()
  await api.addFolderItem(folder,me,{kind:'audio',blob:new Blob(['first voice'],{type:'audio/wav'}),title:'Une voix'})
  await api.addFolderItem(folder,me,{kind:'video',blob:new Blob(['a clip'],{type:'video/mp4'}),title:'Une vidéo'})
  state = await api.load(fid)
  const vocal = state.folderItems.find(i=>i.kind==='audio')
  assert.match(vocal.media_url,/^data:audio\/wav/)
  assert.equal(vocal.image_path,null)
  assert.match(state.folderItems.find(i=>i.kind==='video').media_url,/^data:video\/mp4/)
  await api.replaceFolderMedia(vocal,new Blob(['new voice'],{type:'audio/wav'}),{title:'Une autre voix'})
  state = await api.load(fid)
  const replaced = state.folderItems.find(i=>i.id===vocal.id)
  assert.equal(replaced.title,'Une autre voix')
  assert.notEqual(replaced.media_url,vocal.media_url)
  assert.equal(state.folderItems.filter(i=>i.kind==='audio').length,1)
  assert.deepEqual(state.moments.map(m=>m.id).sort(),originalIds)
  console.log('PASS audio/video persistence, stable replacement identity and untouched discussion')

  const count = state.folderItems.length
  quota = Math.max(...Array.from(storage.values(),v=>v.length)) + 5
  await assert.rejects(api.replaceFolderMedia(replaced,new Blob(['x'.repeat(10000)],{type:'audio/wav'})),/STOCKAGE_PLEIN/)
  await assert.rejects(api.addFolderItem(folder,me,{kind:'video',blob:new Blob(['x'.repeat(10000)],{type:'video/mp4'})}),/STOCKAGE_PLEIN/)
  quota = Infinity
  state = await api.load(fid)
  assert.equal(state.folderItems.length,count)
  assert.equal(state.folderItems.find(i=>i.id===vocal.id).media_url,replaced.media_url)
  assert.deepEqual(state.moments.map(m=>m.id).sort(),originalIds)
  console.log('PASS quota failure rolls back both add/replace without pruning original messages')
} finally { await rm(temp,{recursive:true,force:true}) }
