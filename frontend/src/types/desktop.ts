export type AppRuntimeInfo = {
  name: string
  version: string
  platform: string
  arch: string
  dataDir: string
  hasRuntime: boolean
}

export type LicenseStatus = {
  status: 'active' | 'expired' | 'unactivated' | 'unknown'
  message: string
  deviceId: string
  displayId: string
  createdAt?: number
  expiresAt?: number
  daysLeft?: number
  remainingText?: string
}

export type ActivationResult = {
  success: boolean
  reason: string
  expiresAt?: number
}

export type DriveTypeInfo = {
  driveType: string
  displayName: string
  isRemovable: boolean
}
