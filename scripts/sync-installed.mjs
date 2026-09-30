#!/usr/bin/env node
/**
 * Copy this checkout's build outputs into an installed copy of the plugin.
 *
 * WHY THIS EXISTS
 * ---------------
 * Installing a local plugin with `file:` makes the package manager materialise it
 * as a HARD-LINK FARM: every installed file shares an inode with the file in this
 * checkout. That looks like it stays in sync, and for files you never rewrite it
 * does. But a build does not edit `lib/client.js` in place -- esbuild writes a new
 * file and renames it over the old one, which allocates a NEW inode. The hard link
 * is broken at that moment, and from then on the installed copy keeps serving the
 * PREVIOUS build forever while the checkout looks perfectly up to date.
 *
 * The failure is silent: no error, no version mismatch, no warning. The only
 * symptom is that a change you made is simply not there in the running harness.
 *
 * So: after every `node build.mjs`, run this before restarting DSH.
 *
 *   node scripts/sync-installed.mjs                     # default: $DSH_HOME/profiles/web/...
 *   node scripts/sync-installed.mjs /path/to/installed  # explicit target
 *
 * It only ever writes files that already exist in the target, refuses to create a
 * target that does not look like an installed copy of this plugin, and reports
 * every file it changes.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(dirname(fileURLToPath(import.meta.url)))
const PACKAGE_NAME = 'dsh-omp-advisor'
/** Runtime-relevant files. Sources/tests are irrelevant to an installed copy. */
const FILES = [
  'lib/index.js',
  'lib/index.js.map',
  'lib/client.js',
  'lib/client.js.map',
  'package.json',
  'cordis.patch.yml'
]

function defaultTarget() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'profiles', 'web', 'node_modules', PACKAGE_NAME)
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const target = resolve(process.argv[2] || defaultTarget())

if (target === HERE) {
  console.error(`refusing to sync ${HERE} onto itself`)
  process.exit(1)
}
if (!existsSync(target)) {
  console.error(`not an installed copy: ${target} does not exist`)
  console.error('pass the installed path explicitly if it lives somewhere else')
  process.exit(1)
}

const manifest = join(target, 'package.json')
if (!existsSync(manifest)) {
  console.error(`refusing to write into ${target}: no package.json there`)
  process.exit(1)
}
const installed = JSON.parse(readFileSync(manifest, 'utf8'))
if (installed.name !== PACKAGE_NAME) {
  console.error(`refusing to write into ${target}: it holds "${installed.name}", not "${PACKAGE_NAME}"`)
  process.exit(1)
}

const changed = []
const missing = []
for (const file of FILES) {
  const from = join(HERE, file)
  const to = join(target, file)
  if (!existsSync(from)) {
    missing.push(file)
    continue
  }
  // Never create a file in the installed copy that was not installed -- the file
  // list above is a sync set, not an install manifest.
  const toExists = existsSync(to)
  if (toExists && statSync(from).isFile() && statSync(to).isFile() && digest(from) === digest(to)) continue
  copyFileSync(from, to)
  changed.push(`${file}${toExists ? '' : ' (new)'}`)
}

for (const file of changed) console.log(`synced  ${file}`)
for (const file of missing) console.warn(`skipped ${file} (not built in this checkout)`)
if (changed.length === 0) console.log(`already in sync: ${target}`)
else console.log(`\n${changed.length} file(s) updated in ${target}\nRestart DSH Web for the host half and reload the page for the client half.`)
