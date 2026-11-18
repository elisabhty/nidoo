import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformWithEsbuild } from 'vite'

/** Compile un module TypeScript pur avec le compilateur déjà fourni par Vite. */
export async function loadTs(path) {
  const filename = resolve(process.cwd(), path)
  const source = readFileSync(filename, 'utf8')
  const { code } = await transformWithEsbuild(source, filename, { loader: 'ts', target: 'es2022' })
  // Les modules testés ne comportent que des imports de types, effacés à la compilation.
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
