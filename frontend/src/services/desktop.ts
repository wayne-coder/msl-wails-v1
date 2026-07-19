import type { ActivationResult, AppRuntimeInfo, DriveTypeInfo, LicenseStatus } from '@/types/desktop'

export interface FileStorageResult {
  success: boolean
  data: string
  error: string
}

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          GetRuntimeInfo?: () => Promise<AppRuntimeInfo>
          GetDriveTypeInfo?: () => Promise<DriveTypeInfo>
          GetMachineCode?: () => Promise<string>
          GetLicenseStatus?: () => Promise<LicenseStatus>
          ActivateLicense?: (code: string) => Promise<ActivationResult>
          ReadDataFile?: (filename: string) => Promise<FileStorageResult>
          WriteDataFile?: (filename: string, data: string) => Promise<FileStorageResult>
          DeleteDataFile?: (filename: string) => Promise<FileStorageResult>
        }
      }
    }
  }
}

const fallbackInfo: AppRuntimeInfo = {
  name: '码上录',
  version: '1.0.0',
  platform: '浏览器',
  arch: '未知',
  dataDir: '本地存储',
  hasRuntime: false,
}

export async function getRuntimeInfo(): Promise<AppRuntimeInfo> {
  const runtime = window.go?.main?.App?.GetRuntimeInfo
  if (!runtime) {
    return fallbackInfo
  }

  try {
    return await runtime()
  } catch {
    return fallbackInfo
  }
}

export async function getMachineCode(): Promise<string> {
  const method = window.go?.main?.App?.GetMachineCode
  if (!method) {
    return ''
  }

  try {
    return await method()
  } catch {
    return ''
  }
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const method = window.go?.main?.App?.GetLicenseStatus
  if (!method) {
    return {
      status: 'unknown',
      message: '桌面运行环境不可用',
      deviceId: '',
      displayId: '',
    }
  }

  try {
    return await method()
  } catch {
    return {
      status: 'unknown',
      message: '无法读取授权状态',
      deviceId: '',
      displayId: '',
    }
  }
}

export async function getDriveTypeInfo(): Promise<DriveTypeInfo> {
  const method = window.go?.main?.App?.GetDriveTypeInfo
  if (!method) {
    return {
      driveType: 'unknown',
      displayName: '浏览器环境',
      isRemovable: false,
    }
  }

  try {
    return await method()
  } catch {
    return {
      driveType: 'unknown',
      displayName: '未知设备',
      isRemovable: false,
    }
  }
}

export async function activateLicense(code: string): Promise<ActivationResult> {
  const method = window.go?.main?.App?.ActivateLicense
  if (!method) {
    return {
      success: false,
      reason: '桌面运行环境不可用',
    }
  }

  try {
    return await method(code)
  } catch {
    return {
      success: false,
      reason: '激活失败',
    }
  }
}
