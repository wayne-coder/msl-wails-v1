package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	licenseFileName = ".license"
	// NOTE: Replace this with the output of "license-gen keygen" before building.
	publicKeyPEM = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEADJlvMKIlNTzWHfA2nUwEB56GJ/K\nhOJOK8/080DH66kPZjHLtiw15S4/JUzN6X1ArIBGVEAVOezsC4kzLUZGcQ==\n-----END PUBLIC KEY-----"
)

type buildInfo struct {
	BuildID      string `json:"buildId"`
	GeneratedAt  string `json:"generatedAt"`
	BuildVersion string `json:"buildVersion"`
}

type licensePayload struct {
	DeviceID  string `json:"d"`
	ExpiresAt int64  `json:"e"`
	Features  int    `json:"f"`
	IssuedAt  int64  `json:"i"`
}

type storedLicense struct {
	DeviceID     string `json:"deviceId"`
	CreatedAt    int64  `json:"createdAt"`
	ExpiresAt    int64  `json:"expiresAt"`
	Features     int    `json:"features"`
	LicenseCode  string `json:"licenseCode"`
	VolumeSerial string `json:"volumeSerial"`
	DriveType    string `json:"driveType"`
}

type LicenseStatus struct {
	Status        string `json:"status"`
	Message       string `json:"message"`
	DeviceID      string `json:"deviceId"`
	DisplayID     string `json:"displayId"`
	CreatedAt     int64  `json:"createdAt,omitempty"`
	ExpiresAt     int64  `json:"expiresAt,omitempty"`
	DaysLeft      int    `json:"daysLeft,omitempty"`
	RemainingText string `json:"remainingText,omitempty"`
}

type ActivationResult struct {
	Success   bool   `json:"success"`
	Reason    string `json:"reason"`
	ExpiresAt int64  `json:"expiresAt,omitempty"`
}

type licenseVerification struct {
	Valid   bool
	Reason  string
	Payload licensePayload
}

var (
	buildInfoOnce sync.Once
	cachedBuild   buildInfo
	buildInfoErr  error
)

func (a *App) GetMachineCode() string {
	deviceID, _, err := getDeviceInfo()
	if err != nil {
		return ""
	}
	return deviceID
}

func (a *App) GetLicenseStatus() LicenseStatus {
	deviceID, displayID, err := getDeviceInfo()
	if err != nil {
		return LicenseStatus{
			Status:    "unknown",
			Message:   "无法获取设备标识",
			DisplayID: "unknown",
		}
	}

	license, reason, valid := readLicenseFile(deviceID)
	if license == nil {
		return LicenseStatus{
			Status:    "unactivated",
			Message:   reason,
			DeviceID:  deviceID,
			DisplayID: displayID,
		}
	}

	remaining := time.Until(time.UnixMilli(license.ExpiresAt))
	daysLeft := int(remaining.Hours() / 24)

	if time.Now().UnixMilli() > license.ExpiresAt {
		return LicenseStatus{
			Status:    "expired",
			Message:   reason,
			DeviceID:  deviceID,
			DisplayID: displayID,
			CreatedAt: license.CreatedAt,
			ExpiresAt: license.ExpiresAt,
			DaysLeft:  0,
		}
	}

	if daysLeft < 0 {
		daysLeft = 0
	}

	message := reason
	if valid {
		message = fmt.Sprintf("授权有效，剩余 %s", formatRemaining(remaining))
	}

	return LicenseStatus{
		Status:        "active",
		Message:       message,
		DeviceID:      deviceID,
		DisplayID:     displayID,
		CreatedAt:     license.CreatedAt,
		ExpiresAt:     license.ExpiresAt,
		DaysLeft:      daysLeft,
		RemainingText: formatRemaining(remaining),
	}
}

func (a *App) ActivateLicense(code string) ActivationResult {
	deviceID, _, err := getDeviceInfo()
	if err != nil {
		return ActivationResult{
			Success: false,
			Reason:  "无法获取设备标识",
		}
	}

	verification := verifyLicenseCode(code, deviceID)
	if !verification.Valid {
		return ActivationResult{
			Success: false,
			Reason:  verification.Reason,
		}
	}

	createdAt := time.Now().UnixMilli()
	if existing, _, _ := readLicenseFile(deviceID); existing != nil && existing.CreatedAt > 0 {
		createdAt = existing.CreatedAt
	}

	if err := writeLicenseFile(storedLicense{
		DeviceID:     deviceID,
		CreatedAt:    createdAt,
		ExpiresAt:    verification.Payload.ExpiresAt,
		Features:     verification.Payload.Features,
		LicenseCode:  normalizeLicenseCode(code),
		VolumeSerial: getLicenseVolumeSerial(),
		DriveType:    getExeDriveType().String(),
	}); err != nil {
		return ActivationResult{
			Success: false,
			Reason:  "写入授权文件失败",
		}
	}

	return ActivationResult{
		Success:   true,
		Reason:    fmt.Sprintf("激活成功，授权有效期至 %s", time.UnixMilli(verification.Payload.ExpiresAt).Format("2006-01-02")),
		ExpiresAt: verification.Payload.ExpiresAt,
	}
}

func getDeviceInfo() (string, string, error) {
	info, err := loadBuildInfo()
	if err != nil {
		return "", "", err
	}
	dt := getExeDriveType()
	deviceID := fmt.Sprintf("BUILD:%s:%s", info.BuildID, dt.String())
	displayID := fmt.Sprintf("%s (%s)", info.BuildID, dt.DisplayName())
	return deviceID, displayID, nil
}

const deviceIDFileName = ".device-id"

// getDeviceIDDir returns the directory where the persistent device-id file is stored.
// Same directory as the license file.
func getDeviceIDDir() (string, error) {
	dt := getExeDriveType()

	if dt == DriveRemovable {
		exePath, err := os.Executable()
		if err != nil {
			return "", err
		}
		return filepath.Join(filepath.Dir(exePath), "MSL_Data"), nil
	}

	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "msl_wails_v1"), nil
}

func loadPersistedDeviceID() string {
	dir, err := getDeviceIDDir()
	if err != nil {
		return ""
	}

	data, err := os.ReadFile(filepath.Join(dir, deviceIDFileName))
	if err != nil {
		return ""
	}

	id := strings.TrimSpace(string(data))
	if len(id) < 4 {
		return ""
	}
	return id
}

func savePersistedDeviceID(id string) {
	dir, err := getDeviceIDDir()
	if err != nil {
		return
	}

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}

	os.WriteFile(filepath.Join(dir, deviceIDFileName), []byte(id+"\n"), 0o644)
}

func generatePersistentDeviceID() string {
	// Use crypto/rand for a stable random identifier that persists across restarts.
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		// Absolute fallback — should never happen.
		hash := sha256.Sum256([]byte(fmt.Sprintf("%d|%s", time.Now().UnixNano(), runtime.GOOS)))
		return "DEV-" + strings.ToUpper(fmt.Sprintf("%x", hash[:4]))
	}
	return "DEV-" + strings.ToUpper(fmt.Sprintf("%x", b[:]))
}

func loadBuildInfo() (buildInfo, error) {
	buildInfoOnce.Do(func() {
		// 1) Try build-id.json from the build system (production builds).
		candidates := []string{}

		if exePath, err := os.Executable(); err == nil {
			exeDir := filepath.Dir(exePath)
			candidates = append(candidates, filepath.Join(exeDir, "build-id.json"))
			candidates = append(candidates, filepath.Join(exeDir, "electron", "build-id.json"))
		}

		if cwd, err := os.Getwd(); err == nil {
			candidates = append(candidates, filepath.Join(cwd, "electron", "build-id.json"))
			candidates = append(candidates, filepath.Join(cwd, "build-id.json"))
		}

		for _, candidate := range candidates {
			data, err := os.ReadFile(candidate)
			if err != nil {
				continue
			}

			var parsed buildInfo
			if err := json.Unmarshal(data, &parsed); err != nil {
				continue
			}

			if strings.TrimSpace(parsed.BuildID) != "" {
				cachedBuild = parsed
				return
			}
		}

		// 2) Try a persisted device-id file (generated on first run).
		persisted := loadPersistedDeviceID()
		if persisted != "" {
			cachedBuild = buildInfo{
				BuildID:      persisted,
				GeneratedAt:  time.Now().Format(time.RFC3339),
				BuildVersion: "dev",
			}
			return
		}

		// 3) No persisted ID yet — generate one and save it so it survives restarts.
		newID := generatePersistentDeviceID()
		savePersistedDeviceID(newID)

		cachedBuild = buildInfo{
			BuildID:      newID,
			GeneratedAt:  time.Now().Format(time.RFC3339),
			BuildVersion: "dev",
		}
	})

	return cachedBuild, buildInfoErr
}

func verifyLicenseCode(code string, currentDeviceID string) licenseVerification {
	payloadText, payload, signature, err := parseLicenseCode(code)
	if err != nil {
		return licenseVerification{Valid: false, Reason: "授权码格式无效"}
	}

	validSignature, err := verifySignatureRaw(payloadText, signature)
	if err != nil || !validSignature {
		return licenseVerification{Valid: false, Reason: "授权码签名验证失败"}
	}

	if payload.DeviceID != currentDeviceID {
		return licenseVerification{Valid: false, Reason: "授权码与当前设备不匹配"}
	}

	if time.Now().UnixMilli() > payload.ExpiresAt {
		return licenseVerification{Valid: false, Reason: "授权已过期"}
	}

	return licenseVerification{
		Valid:   true,
		Reason:  "ok",
		Payload: payload,
	}
}

func parseLicenseCode(code string) (string, licensePayload, []byte, error) {
	cleaned := normalizeLicenseCode(code)
	if !strings.HasPrefix(cleaned, "MSLV1") {
		return "", licensePayload{}, nil, errors.New("授权码前缀无效")
	}

	token := strings.TrimPrefix(cleaned, "MSLV1")
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return "", licensePayload{}, nil, errors.New("授权码内容无效")
	}

	payloadRaw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", licensePayload{}, nil, err
	}

	signatureRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", licensePayload{}, nil, err
	}

	if len(signatureRaw) != 64 {
		return "", licensePayload{}, nil, errors.New("签名长度异常")
	}

	var payload licensePayload
	if err := json.Unmarshal(payloadRaw, &payload); err != nil {
		return "", licensePayload{}, nil, err
	}

	if payload.DeviceID == "" || payload.ExpiresAt == 0 {
		return "", licensePayload{}, nil, errors.New("缺少必要字段")
	}

	return string(payloadRaw), payload, signatureRaw, nil
}

func normalizeLicenseCode(code string) string {
	replacer := strings.NewReplacer(" ", "", "\t", "", "\r", "", "\n", "")
	return replacer.Replace(strings.TrimSpace(code))
}

func verifySignatureRaw(payload string, rawSignature []byte) (bool, error) {
	pub, err := parsePublicKey()
	if err != nil {
		return false, err
	}

	if len(rawSignature) != 64 {
		return false, errors.New("签名长度无效")
	}

	hash := sha256.Sum256([]byte(payload))
	r := new(big.Int).SetBytes(rawSignature[:32])
	s := new(big.Int).SetBytes(rawSignature[32:])
	return ecdsa.Verify(pub, hash[:], r, s), nil
}

func parsePublicKey() (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return nil, errors.New("公钥解析失败")
	}

	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	pub, ok := parsed.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("公钥类型异常")
	}

	if pub.Curve != elliptic.P256() {
		return nil, errors.New("曲线类型异常")
	}

	return pub, nil
}

func readLicenseFile(currentDeviceID string) (*storedLicense, string, bool) {
	path, err := getLicensePath()
	if err != nil {
		return nil, "无法定位授权文件路径", false
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "未找到授权文件", false
	}

	var license storedLicense
	if err := json.Unmarshal(data, &license); err != nil {
		return nil, "授权文件无效", false
	}

	verification := verifyLicenseCode(license.LicenseCode, currentDeviceID)
	if !verification.Valid {
		return nil, verification.Reason, false
	}

	// Reject if the license was issued for a different drive type (USB vs computer).
	currentDriveType := getExeDriveType().String()
	if license.DriveType != "" && license.DriveType != currentDriveType {
		return nil, fmt.Sprintf("授权环境不匹配：授权绑定在%s，当前运行在%s",
			parseDriveType(license.DriveType).DisplayName(),
			getExeDriveType().DisplayName()), false
	}

	if license.VolumeSerial != "" {
		currentSerial := getLicenseVolumeSerial()
		if currentSerial != "" && !strings.EqualFold(currentSerial, license.VolumeSerial) {
			return nil, "磁盘绑定不匹配", false
		}
	}

	if time.Now().UnixMilli() > license.ExpiresAt {
		return &license, "授权已过期", false
	}

	return &license, "授权有效", true
}

func writeLicenseFile(license storedLicense) error {
	path, err := getLicensePath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(license, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o644)
}

func getLicensePath() (string, error) {
	dt := getExeDriveType()

	// USB / removable media: store license alongside the executable so it travels with the drive.
	if dt == DriveRemovable {
		exePath, err := os.Executable()
		if err != nil {
			return "", err
		}
		return filepath.Join(filepath.Dir(exePath), "MSL_Data", licenseFileName), nil
	}

	// Local fixed disk: store in the user's config directory.
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "msl_wails_v1", licenseFileName), nil
}

// formatRemaining formats a duration into a precise human-readable Chinese string.
// Examples: "365天 12小时 35分钟", "3小时 5分钟", "45分钟"
func formatRemaining(d time.Duration) string {
	if d <= 0 {
		return "已过期"
	}

	totalMinutes := int(d.Minutes())
	days := totalMinutes / 1440
	hours := (totalMinutes % 1440) / 60
	minutes := totalMinutes % 60

	var parts []string
	if days > 0 {
		parts = append(parts, fmt.Sprintf("%d天", days))
	}
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%d小时", hours))
	}
	if minutes > 0 || len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("%d分钟", minutes))
	}

	return strings.Join(parts, " ")
}

func getLicenseVolumeSerial() string {
	if runtime.GOOS != "windows" {
		return ""
	}

	licensePath, err := getLicensePath()
	if err != nil {
		return ""
	}

	root := filepath.VolumeName(licensePath)
	if root == "" {
		return ""
	}

	if !strings.HasSuffix(root, "\\") {
		root += "\\"
	}

	cmd := exec.CommandContext(context.Background(), "cmd", "/c", "vol", root)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return ""
	}

	re := regexp.MustCompile(`[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}`)
	match := re.FindString(string(output))
	return strings.ToUpper(match)
}
