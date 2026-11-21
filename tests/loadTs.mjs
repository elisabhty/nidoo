import { resolve } from 'node:path'
import { build } from 'esbuild'

/** Compile un module TypeScript pur (et les modules du projet qu'il importe) avec esbuild, déjà fourni par Vite. */
export async function loadTs(path) {
  const r = await build({
    entryPoints: [resolve(process.cwd(), path)],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    packages: 'external',
    logLevel: 'silent',
  })
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'))
}
