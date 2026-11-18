import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** Transpile un module TypeScript pur pour le tester avec node:test, sans dépendance de test. */
export async function loadTs(path) {
  const filename = resolve(process.cwd(), path)
  const source = readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: 99, target: 9 },
  })
  // Les modules testés n'ont que des imports TypeScript de types, supprimés à la transpilation.
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
}
