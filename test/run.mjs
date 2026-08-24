/** Test runner: bundle the units under test, then run node:test over them. */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [join(root, 'test/entry.ts')],
  outfile: join(root, 'test/.bundle.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  loader: { '.md': 'text' },
  alias: { '@deepseek-ai/schemastery': join(root, 'test/stubs/schemastery.ts') },
  logLevel: 'warning'
})

const result = spawnSync(
  process.execPath,
  ['--test', join(root, 'test/advisor.test.mjs')],
  { stdio: 'inherit', cwd: root }
)
process.exit(result.status ?? 1)
