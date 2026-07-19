// fileStorage.ts - Abstracts Go-backed file I/O in MSL_Data/ with localStorage fallback for browser dev mode.

const BROWSER_PREFIX = 'msl_file_'

function isRuntimeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.go?.main?.App?.WriteDataFile
}

/** Read a file from MSL_Data/. Returns null when the file doesn't exist or on error. */
export async function readFile(filename: string): Promise<string | null> {
  if (!isRuntimeAvailable()) {
    const raw = localStorage.getItem(BROWSER_PREFIX + filename)
    return raw
  }

  try {
    const result = await window.go!.main!.App!.ReadDataFile!(filename)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** Write content to a file in MSL_Data/. Returns true on success. */
export async function writeFile(filename: string, data: string): Promise<boolean> {
  if (!isRuntimeAvailable()) {
    try {
      localStorage.setItem(BROWSER_PREFIX + filename, data)
      return true
    } catch {
      return false
    }
  }

  try {
    const result = await window.go!.main!.App!.WriteDataFile!(filename, data)
    return result.success
  } catch {
    return false
  }
}

/** Delete a file in MSL_Data/. Returns true on success (idempotent — deleting non-existent file is success). */
export async function deleteFile(filename: string): Promise<boolean> {
  if (!isRuntimeAvailable()) {
    localStorage.removeItem(BROWSER_PREFIX + filename)
    return true
  }

  try {
    const result = await window.go!.main!.App!.DeleteDataFile!(filename)
    return result.success
  } catch {
    return false
  }
}
