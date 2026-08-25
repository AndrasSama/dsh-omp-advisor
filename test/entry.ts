/** Test bundle entry: re-export the units under test (pure modules + loop). */
export * from '../src/advise-tool'
export * from '../src/delivery'
export * from '../src/quarantine'
export * from '../src/delta'
export * from '../src/tools'
export { normalizeSettings, normalizeSettingsLenient, advisorMatchesWorkspace } from '../src/settings'
export { AdvisorLoop } from '../src/advisor-loop'
export { extractMemoryLesson } from '../src/advisor-loop'
export { SessionAdvisorRuntime } from '../src/runtime'
export { AdvisorService } from '../src/service'
export { registerAdvisorRpc, RPC_CHANNEL } from '../src/rpc'
export { mountAdvisorSidebarTab } from '../src/client/sidebar'
export { shiftExpandedAfterRemove } from '../src/client/SettingsSection'
export {
  normalizeMemorySettings,
  PRESET_ENGINES,
  BUILTIN_MD_ENGINE,
  expandHome
} from '../src/memory/engines'
export { packMemoryItems, normalizeItem, renderMemoryBlock } from '../src/memory/pack'
export {
  appendLesson,
  parseLessons,
  recallLessons,
  renderLessonEntry,
  tokenize
} from '../src/memory/md-store'
export { MemoryManager } from '../src/memory/manager'
export {
  probeGit,
  clearProbeCache,
  createRestorePoint,
  listRestorePoints,
  diffRestorePoints,
  pruneRestorePoints,
  markRestorePointAccepted,
  restoreInstructions,
  commitInstructions
} from '../src/restore-points'
