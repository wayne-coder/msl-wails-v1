package main

import (
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

// DriveType represents the physical drive type where the application is running from.
type DriveType int

const (
	DriveUnknown   DriveType = 0 // DRIVE_UNKNOWN
	DriveNoRoot    DriveType = 1 // DRIVE_NO_ROOT_DIR
	DriveRemovable DriveType = 2 // DRIVE_REMOVABLE — USB flash drives, external HDDs
	DriveFixed     DriveType = 3 // DRIVE_FIXED — internal hard disks, SSDs
	DriveRemote    DriveType = 4 // DRIVE_REMOTE — network mapped drives
	DriveCDROM     DriveType = 5 // DRIVE_CDROM
	DriveRAMDisk   DriveType = 6 // DRIVE_RAMDISK
)

// getExeDriveType returns the drive type of the volume containing the running executable.
// On non-Windows platforms it defaults to DriveFixed since removable-media detection
// is a Windows-specific authorization concern.
func getExeDriveType() DriveType {
	if runtime.GOOS != "windows" {
		return DriveFixed
	}

	exePath, err := os.Executable()
	if err != nil {
		return DriveUnknown
	}

	return getDriveTypeWindows(exePath)
}

// getDriveTypeWindows calls the Win32 GetDriveTypeW API for the root of the given path.
func getDriveTypeWindows(path string) DriveType {
	root := filepath.VolumeName(path)
	if root == "" {
		return DriveNoRoot
	}
	root += "\\"

	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	procGetDriveType := kernel32.NewProc("GetDriveTypeW")

	rootPtr, err := syscall.UTF16PtrFromString(root)
	if err != nil {
		return DriveUnknown
	}

	ret, _, _ := procGetDriveType.Call(uintptr(unsafe.Pointer(rootPtr)))
	return DriveType(ret)
}

// String returns the machine-readable drive type identifier used in device IDs.
func (d DriveType) String() string {
	switch d {
	case DriveFixed:
		return "fixed"
	case DriveRemovable:
		return "removable"
	case DriveRemote:
		return "remote"
	case DriveCDROM:
		return "cdrom"
	case DriveRAMDisk:
		return "ramdisk"
	case DriveNoRoot:
		return "noroot"
	default:
		return "unknown"
	}
}

// DisplayName returns a human-readable Chinese label for the drive type.
func (d DriveType) DisplayName() string {
	switch d {
	case DriveFixed:
		return "本地电脑"
	case DriveRemovable:
		return "U盘"
	case DriveRemote:
		return "网络驱动器"
	case DriveCDROM:
		return "光盘"
	case DriveRAMDisk:
		return "内存盘"
	default:
		return "未知设备"
	}
}

// isRemovableDrive is a convenience check for USB/external media.
func isRemovableDrive() bool {
	return getExeDriveType() == DriveRemovable
}

// parseDriveType converts a drive-type label (e.g. "removable", "fixed") back to a DriveType.
// Returns DriveUnknown for unrecognized strings.
func parseDriveType(s string) DriveType {
	switch s {
	case "fixed":
		return DriveFixed
	case "removable":
		return DriveRemovable
	case "remote":
		return DriveRemote
	case "cdrom":
		return DriveCDROM
	case "ramdisk":
		return DriveRAMDisk
	case "noroot":
		return DriveNoRoot
	default:
		return DriveUnknown
	}
}
