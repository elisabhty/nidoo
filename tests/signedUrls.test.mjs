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
