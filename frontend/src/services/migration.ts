// migration.ts - One-time localStorage → MSL_Data/ file migration.
// Runs on app startup after the Wails runtime is available.

import { writeFile } from './fileStorage'

const MIGRATION_FLAG_KEY = 'msl_migrated_to_files_v1'

// localStorage keys from the old persistence system.
const LEGACY_KEYS = {
  macauAmounts: 'msl_macauAmounts',
  hongkongAmounts: 'msl_hongkongAmounts',
  records: 'msl_records',
  macauDrawn: 'msl_macauDrawn',
  hkDrawn: 'msl_hkDrawn',
  players: 'msl_players',
  textReceiveConfig: 'msl_textReceiveConfig',
} as const

// Maps legacy localStorage keys to their corresponding file names in MSL_Data/.
const FILE_MAP: Record<string, string> = {
  [LEGACY_KEYS.macauAmounts]: 'macau-amounts.json',
  [LEGACY_KEYS.hongkongAmounts]: 'hongkong-amounts.json',
  [LEGACY_KEYS.records]: 'records.json',
  [LEGACY_KEYS.macauDrawn]: 'macau-drawn.json',
  [LEGACY_KEYS.hkDrawn]: 'hk-drawn.json',
  [LEGACY_KEYS.players]: 'players.json',
  [LEGACY_KEYS.textReceiveConfig]: 'text-receive-config.json',
}

export async function migrateIfNeeded(): Promise<string[]> {
  // Already migrated — skip.
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') return []

  const migrated: string[] = []

  for (const [localKey, fileName] of Object.entries(FILE_MAP)) {
    const raw = localStorage.getItem(localKey)
    if (raw) {
      if (await writeFile(fileName, raw)) {
        migrated.push(fileName)
      }
    }
  }

  // Mark migration as done so we don't run again.
  localStorage.setItem(MIGRATION_FLAG_KEY, 'done')

  return migrated
}
