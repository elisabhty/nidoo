import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'

const { createSignedUrlCache } = await loadTs('src/lib/signedUrls.ts')

test('réutilise une URL signée et ne redemande que les nouveaux fichiers', async () => {
  let calls = []
  let time = 1000
  const urls = createSignedUrlCache(async (bucket, paths) => {
    calls.push([bucket, [...paths]])
    return paths.map((path) => ({ path, signedUrl: bucket + '/' + path + '?at=' + time }))
  }, () => time)
  const first = await urls('moments', ['a.jpg', 'a.jpg', null])
  assert.equal(first.get('a.jpg'), 'moments/a.jpg?at=1000')
  await urls('moments', ['a.jpg', 'b.jpg'])
  assert.deepEqual(calls, [['moments', ['a.jpg']], ['moments', ['b.jpg']]])
  time += 55 * 60000 + 1
  await urls('moments', ['a.jpg'])
  assert.equal(calls.length, 3)
})

test('ne mélange pas les buckets, et ignore les liens non retournés', async () => {
  const urls = createSignedUrlCache(async (bucket, paths) =>
    paths.filter((p) => p !== 'absent.jpg').map((p) => ({ path: p, signedUrl: bucket + ':' + p })),
  )
  assert.equal((await urls('moments', ['a.jpg', 'absent.jpg'])).has('absent.jpg'), false)
  assert.equal((await urls('dossiers', ['a.jpg'])).get('a.jpg'), 'dossiers:a.jpg')
})

test('garde les liens d’un lancement à l’autre, et oublie ceux qui ont expiré', async () => {
  let time = 1000
  let disque = null
  const garde = { lire: async () => disque, ecrire: (l) => (disque = JSON.parse(JSON.stringify(l))) }
  const calls = []
  const sign = async (bucket, paths) => {
    calls.push([...paths])
    return paths.map((path) => ({ path, signedUrl: path + '?at=' + time }))
  }
  const a = createSignedUrlCache(sign, () => time, 1000, garde)
  assert.equal((await a('moments', ['a.jpg', 'b.jpg'])).get('a.jpg'), 'a.jpg?at=1000')
  // nouveau lancement : mêmes adresses, rien n'est redemandé
  time += 500
  const b = createSignedUrlCache(sign, () => time, 1000, garde)
  assert.equal((await b('moments', ['a.jpg'])).get('a.jpg'), 'a.jpg?at=1000')
  assert.equal(calls.length, 1)
  // passé le délai, le lien est redemandé et l'ancien n'est plus gardé
  time += 600
  const c = createSignedUrlCache(sign, () => time, 1000, garde)
  assert.equal((await c('moments', ['a.jpg'])).get('a.jpg'), 'a.jpg?at=2100')
  assert.deepEqual(Object.keys(disque), ['moments:a.jpg'])
})

test('un disque illisible n’empêche rien', async () => {
  const garde = { lire: async () => { throw new Error('refusé') }, ecrire: () => undefined }
  const urls = createSignedUrlCache(async (b, paths) => paths.map((path) => ({ path, signedUrl: 'u:' + path })), () => 1, 1000, garde)
  assert.equal((await urls('moments', ['a.jpg'])).get('a.jpg'), 'u:a.jpg')
})
