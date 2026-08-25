/** Test runner: bundle the units under test, then run node:test over them. */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Regenerate the embedded skill files so tests always see the skills/ tree.
const gen = spawnSync(process.execPath, [join(root, 'scripts/gen-skills.mjs')], {
  stdio: 'inherit',
  cwd: root
})
if (gen.status !== 0) process.exit(gen.status ?? 1)

await build({
  entryPoints: [join(root, 'test/entry.ts')],
  outfile: join(root, 'test/.bundle.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  loader: { '.md': 'text' },
  alias: {
    '@deepseek-ai/schemastery': join(root, 'test/stubs/schemastery.ts'),
    '@deepseek-ai/cordis': join(root, 'test/stubs/cordis.ts'),
    '@deepseek-ai/dsh-llm': join(root, 'test/stubs/dsh-llm.ts')
  },
  logLevel: 'warning'
})

const result = spawnSync(
  process.execPath,
  ['--test', join(root, 'test/advisor.test.mjs')],
  { stdio: 'inherit', cwd: root }
)
process.exit(result.status ?? 1)
