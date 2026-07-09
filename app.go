package main

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
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

func resolveDataDir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		cwd, cwdErr := os.Getwd()
		if cwdErr != nil {
			return "msl_wails_v1_data"
		}
		return filepath.Join(cwd, "msl_wails_v1_data")
	}
	return filepath.Join(base, "msl_wails_v1")
}
