package main

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type RuntimeInfo struct {
	Name       string `json:"name"`
	Version    string `json:"version"`
	Platform   string `json:"platform"`
	Arch       string `json:"arch"`
	DataDir    string `json:"dataDir"`
	HasRuntime bool   `json:"hasRuntime"`
}

// DriveTypeInfo describes the physical drive the application is running from.
type DriveTypeInfo struct {
	DriveType   string `json:"driveType"`
	DisplayName string `json:"displayName"`
	IsRemovable bool   `json:"isRemovable"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 如果从 U 盘运行，每 3 秒检测一次拔出，拔出后自动关闭程序
	if isRemovableDrive() {
		go a.monitorUSBRemoval()
	}
}

// monitorUSBRemoval 持续检测 U 盘是否被拔出，拔出后自动退出程序。
func (a *App) monitorUSBRemoval() {
	exePath, err := os.Executable()
	if err != nil {
		return
	}

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			// GetDriveTypeW 返回 DRIVE_NO_ROOT_DIR (1) 表示盘符已不存在，即 U 盘已拔出
			if dt := getDriveTypeWindows(exePath); dt == DriveNoRoot || dt == DriveUnknown {
				wruntime.Quit(a.ctx)
				return
			}
		}
	}
}

// GetDriveTypeInfo returns information about the physical drive the application
// is running from (USB removable drive vs local fixed disk), so the frontend can
// display which environment requires activation.
func (a *App) GetDriveTypeInfo() DriveTypeInfo {
	dt := getExeDriveType()
	return DriveTypeInfo{
		DriveType:   dt.String(),
		DisplayName: dt.DisplayName(),
		IsRemovable: dt == DriveRemovable,
	}
}

func (a *App) GetRuntimeInfo() RuntimeInfo {
	dataDir := resolveDataDir()
	return RuntimeInfo{
		Name:       "码上录",
		Version:    "1.0.0",
		Platform:   localizePlatform(runtime.GOOS),
		Arch:       localizeArch(runtime.GOARCH),
		DataDir:    dataDir,
		HasRuntime: a.ctx != nil,
	}
}

func localizePlatform(value string) string {
	switch value {
	case "windows":
		return "Windows 系统"
	case "darwin":
		return "苹果系统"
	case "linux":
		return "Linux 系统"
	default:
		return value
	}
}

func localizeArch(value string) string {
	switch value {
	case "amd64":
		return "64位"
	case "arm64":
		return "ARM64"
	default:
		return value
	}
}

// resolveMSLDataDir returns <exe_dir>/MSL_Data/ regardless of drive type.
// This ensures all data travels with the application (portable deployment).
// Falls back to <cwd>/MSL_Data/ if os.Executable fails.
func resolveMSLDataDir() string {
	exePath, err := os.Executable()
	if err != nil {
		cwd, cwdErr := os.Getwd()
		if cwdErr != nil {
			return "MSL_Data"
		}
		return filepath.Join(cwd, "MSL_Data")
	}
	return filepath.Join(filepath.Dir(exePath), "MSL_Data")
}

func resolveDataDir() string {
	return resolveMSLDataDir()
}
