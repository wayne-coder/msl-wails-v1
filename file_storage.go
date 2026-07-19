package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

// FileStorageResult is returned by ReadDataFile, WriteDataFile, and DeleteDataFile.
type FileStorageResult struct {
	Success bool   `json:"success"`
	Data    string `json:"data"`
	Error   string `json:"error"`
}

// validFilename matches short descriptive names like "settings.json", "records.json".
// Rejects slashes, backslashes, "..", and any path traversal attempts.
var validFilename = regexp.MustCompile(`^[a-zA-Z0-9_.-]+$`)

func sanitizeFilename(name string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("文件名不能为空")
	}
	if len(name) > 128 {
		return "", fmt.Errorf("文件名过长（最多128字符）")
	}
	if !validFilename.MatchString(name) {
		return "", fmt.Errorf("文件名包含非法字符: %s", name)
	}
	clean := filepath.Clean(name)
	if clean != name {
		return "", fmt.Errorf("文件名无效: %s", name)
	}
	return clean, nil
}

func ensureDataDir() error {
	return os.MkdirAll(resolveMSLDataDir(), 0o755)
}

// ReadDataFile reads a file from MSL_Data/ and returns its content.
// Returns success=false when the file does not exist (not an error — means "no data yet").
func (a *App) ReadDataFile(filename string) FileStorageResult {
	safeName, err := sanitizeFilename(filename)
	if err != nil {
		return FileStorageResult{Success: false, Error: err.Error()}
	}

	fullPath := filepath.Join(resolveMSLDataDir(), safeName)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return FileStorageResult{Success: false, Error: "文件不存在"}
		}
		return FileStorageResult{Success: false, Error: fmt.Sprintf("读取文件失败: %v", err)}
	}

	return FileStorageResult{Success: true, Data: string(data)}
}

// WriteDataFile writes content to a file in MSL_Data/.
// Uses atomic write: write to .tmp then rename, so a crash mid-write never produces a partial file.
func (a *App) WriteDataFile(filename string, data string) FileStorageResult {
	safeName, err := sanitizeFilename(filename)
	if err != nil {
		return FileStorageResult{Success: false, Error: err.Error()}
	}

	if err := ensureDataDir(); err != nil {
		return FileStorageResult{Success: false, Error: fmt.Sprintf("创建数据目录失败: %v", err)}
	}

	fullPath := filepath.Join(resolveMSLDataDir(), safeName)
	tmpPath := fullPath + ".tmp"

	if err := os.WriteFile(tmpPath, []byte(data), 0o644); err != nil {
		return FileStorageResult{Success: false, Error: fmt.Sprintf("写入文件失败: %v", err)}
	}

	if err := os.Rename(tmpPath, fullPath); err != nil {
		// Clean up tmp file on rename failure.
		os.Remove(tmpPath)
		return FileStorageResult{Success: false, Error: fmt.Sprintf("重命名文件失败: %v", err)}
	}

	return FileStorageResult{Success: true}
}

// DeleteDataFile deletes a file in MSL_Data/.
func (a *App) DeleteDataFile(filename string) FileStorageResult {
	safeName, err := sanitizeFilename(filename)
	if err != nil {
		return FileStorageResult{Success: false, Error: err.Error()}
	}

	fullPath := filepath.Join(resolveMSLDataDir(), safeName)
	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			// Deleting a non-existent file is a success (idempotent).
			return FileStorageResult{Success: true}
		}
		return FileStorageResult{Success: false, Error: fmt.Sprintf("删除文件失败: %v", err)}
	}

	return FileStorageResult{Success: true}
}
