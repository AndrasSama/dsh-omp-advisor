// Build script: host ESM bundle + client CJS bundle wrapped for the DSH
// browser ModuleLoader. DSH-provided packages stay external — the runtime
// resolves them. React is provided by the host page for the client bundle.
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

mkdirSync('lib', { recursive: true })

// Embed packaged skills before bundling (host + client generated files).
const gen = spawnSync(process.execPath, ['scripts/gen-skills.mjs'], { stdio: 'inherit' })
if (gen.status !== 0) process.exit(gen.status ?? 1)

const pkg = JSON.parse((await import('node:fs')).readFileSync('package.json', 'utf8'))

// Host half: ESM, one file, DSH packages external.
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  loader: { '.md': 'text' },
  external: ['@deepseek-ai/*', 'node:*'],
  logLevel: 'warning'
})

// Client half: CJS inside the ModuleLoader factory wrapper.
const banner = `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {
var module = { exports: {} }; var exports = module.exports;`
const footer = `
return module.exports; } });`

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  jsx: 'transform',
  loader: { '.md': 'text' },
  external: ['react', 'react-dom'],
  banner: { js: banner },
  footer: { js: footer },
  logLevel: 'warning'
})

console.log('dsh-omp-advisor: built lib/index.js + lib/client.js')
