package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"
)

// licensePayload mirrors the app's licensePayload struct.
type licensePayload struct {
	DeviceID  string `json:"d"`
	ExpiresAt int64  `json:"e"`
	Features  int    `json:"f"`
	IssuedAt  int64  `json:"i"`
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "keygen":
		cmdKeygen()
	case "gen":
		cmdGen()
	case "pubkey":
		cmdPubkey()
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(strings.TrimSpace(`
激活码生成工具

用法:
  license-gen keygen                    生成新的 ECDSA P-256 密钥对
  license-gen pubkey -key <私钥文件>    从私钥提取公钥（PEM 格式，用于嵌入 app）
  license-gen gen                       生成激活码
      -key       <私钥文件路径>         （必填）私钥 PEM 文件
      -device    <设备ID>               （必填）目标设备 ID，如 BUILD:ABC123:fixed
      -days      <天数>                 （默认 365）有效天数
      -features  <功能码>               （默认 1）功能位掩码
`))
}

// ----- keygen -----

func cmdKeygen() {
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	outPriv := fs.String("out", "license_private.pem", "私钥输出路径")
	outPub := fs.String("pubout", "license_public.pem", "公钥输出路径")
	fs.Parse(os.Args[2:])

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		fatal("生成密钥失败:", err)
	}

	// Write private key (PKCS#8)
	privBytes, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		fatal("编码私钥失败:", err)
	}
	writePEM(*outPriv, "PRIVATE KEY", privBytes)
	fmt.Println("私钥已保存到:", *outPriv)

	// Write public key (PKIX)
	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		fatal("编码公钥失败:", err)
	}
	writePEM(*outPub, "PUBLIC KEY", pubBytes)
	fmt.Println("公钥已保存到:", *outPub)

	fmt.Println("\n将以下公钥内容替换到 license_service.go 的 publicKeyPEM 常量中:")
	fmt.Println("---")
	fmt.Println(string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})))
	fmt.Println("---")
}

// ----- pubkey -----

func cmdPubkey() {
	fs := flag.NewFlagSet("pubkey", flag.ExitOnError)
	keyFile := fs.String("key", "", "私钥 PEM 文件路径")
	fs.Parse(os.Args[3:])

	if *keyFile == "" {
		fmt.Println("请指定 -key 参数")
		os.Exit(1)
	}

	priv := loadPrivateKey(*keyFile)
	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		fatal("编码公钥失败:", err)
	}

	fmt.Println(string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})))
}

// ----- gen -----

func cmdGen() {
	fs := flag.NewFlagSet("gen", flag.ExitOnError)
	keyFile := fs.String("key", "", "私钥 PEM 文件路径（必填）")
	deviceID := fs.String("device", "", "设备 ID（必填），如 BUILD:ABC123:fixed")
	days := fs.Int("days", 365, "有效天数")
	features := fs.Int("features", 1, "功能位掩码")
	fs.Parse(os.Args[2:])

	if *keyFile == "" || *deviceID == "" {
		fmt.Println("请指定 -key 和 -device 参数")
		fs.Usage()
		os.Exit(1)
	}

	priv := loadPrivateKey(*keyFile)

	now := time.Now()
	payload := licensePayload{
		DeviceID:  *deviceID,
		ExpiresAt: now.AddDate(0, 0, *days).UnixMilli(),
		Features:  *features,
		IssuedAt:  now.UnixMilli(),
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		fatal("JSON 编码失败:", err)
	}

	// Sign: SHA-256 of payload → ECDSA sign
	hash := sha256.Sum256(payloadJSON)
	r, s, err := ecdsa.Sign(rand.Reader, priv, hash[:])
	if err != nil {
		fatal("签名失败:", err)
	}

	// Encode signature as 64 bytes: r (32) || s (32)
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])

	licenseCode := fmt.Sprintf("MSLV1%s.%s",
		base64.RawURLEncoding.EncodeToString(payloadJSON),
		base64.RawURLEncoding.EncodeToString(sig),
	)

	fmt.Println("========== 激活码 ==========")
	fmt.Println(licenseCode)
	fmt.Println("============================")
	fmt.Println()
	fmt.Printf("设备 ID : %s\n", *deviceID)
	fmt.Printf("签发时间 : %s\n", now.Format("2006-01-02 15:04:05"))
	fmt.Printf("过期时间 : %s\n", time.UnixMilli(payload.ExpiresAt).Format("2006-01-02 15:04:05"))
	fmt.Printf("有效天数 : %d 天\n", *days)
	fmt.Printf("功能码   : %d\n", *features)
}

// ----- helpers -----

func loadPrivateKey(path string) *ecdsa.PrivateKey {
	data, err := os.ReadFile(path)
	if err != nil {
		fatal("读取私钥文件失败:", err)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		fatal("私钥文件格式无效")
	}

	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		fatal("解析私钥失败:", err)
	}

	priv, ok := parsed.(*ecdsa.PrivateKey)
	if !ok {
		fatal("私钥不是 ECDSA 类型")
	}

	if priv.Curve != elliptic.P256() {
		fatal("私钥曲线不是 P-256")
	}

	return priv
}

func writePEM(path, blockType string, bytes []byte) {
	f, err := os.Create(path)
	if err != nil {
		fatal("创建文件失败:", err)
	}
	defer f.Close()

	if err := pem.Encode(f, &pem.Block{Type: blockType, Bytes: bytes}); err != nil {
		fatal("写入 PEM 失败:", err)
	}
}

func fatal(args ...interface{}) {
	fmt.Fprintln(os.Stderr, args...)
	os.Exit(1)
}
