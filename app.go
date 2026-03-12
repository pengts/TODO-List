package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// NotePage 单个便签页
type NotePage struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// AppSettings 应用设置
type AppSettings struct {
	AlwaysOnTop  bool `json:"alwaysOnTop"`
	ActivePageID string `json:"activePageId"`
}

// AppData 持久化数据
type AppData struct {
	Pages    []NotePage  `json:"pages"`
	Settings AppSettings `json:"settings"`
}

// App 应用主结构
type App struct {
	ctx      context.Context
	dataPath string
}

// NewApp 创建应用实例
func NewApp() *App {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".todo-list")
	os.MkdirAll(dir, 0755)
	return &App{
		dataPath: filepath.Join(dir, "data.json"),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) beforeClose(ctx context.Context) bool {
	return false // 允许关闭
}

// LoadData 从JSON文件加载数据
func (a *App) LoadData() *AppData {
	data, err := os.ReadFile(a.dataPath)
	if err != nil {
		return nil
	}
	var appData AppData
	if err := json.Unmarshal(data, &appData); err != nil {
		return nil
	}
	return &appData
}

// SaveData 保存数据到JSON文件
func (a *App) SaveData(appData AppData) error {
	data, err := json.MarshalIndent(appData, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return os.WriteFile(a.dataPath, data, 0644)
}

// GenerateID 生成唯一ID
func (a *App) GenerateID() string {
	return fmt.Sprintf("%x%x", time.Now().UnixNano(), time.Now().UnixMicro()%0xFFFF)
}

// WindowMinimise 最小化窗口
func (a *App) WindowMinimise() {
	runtime.WindowMinimise(a.ctx)
}

// WindowClose 关闭窗口
func (a *App) WindowClose() {
	runtime.Quit(a.ctx)
}

// SetAlwaysOnTop 设置窗口置顶
func (a *App) SetAlwaysOnTop(onTop bool) {
	runtime.WindowSetAlwaysOnTop(a.ctx, onTop)
}

// GetAlwaysOnTop 获取置顶状态（从持久化数据读取）
func (a *App) GetAlwaysOnTop() bool {
	appData := a.LoadData()
	if appData == nil {
		return false
	}
	return appData.Settings.AlwaysOnTop
}
