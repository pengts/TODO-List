package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
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
	AlwaysOnTop map[string]bool `json:"alwaysOnTop"`
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
	pageID   string
}

// NewApp 创建应用实例
func NewApp(pageID string) *App {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".todo-list")
	os.MkdirAll(dir, 0755)
	return &App{
		dataPath: filepath.Join(dir, "data.json"),
		pageID:   pageID,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) beforeClose(ctx context.Context) bool {
	return false
}

// GetPageID 返回当前窗口绑定的pageID
func (a *App) GetPageID() string {
	return a.pageID
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
	if appData.Settings.AlwaysOnTop == nil {
		appData.Settings.AlwaysOnTop = make(map[string]bool)
	}
	return &appData
}

// SaveData 保存数据到JSON文件
func (a *App) SaveData(appData AppData) error {
	if appData.Settings.AlwaysOnTop == nil {
		appData.Settings.AlwaysOnTop = make(map[string]bool)
	}
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

// NewWindow 启动新窗口进程
func (a *App) NewWindow(pageID string) error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exePath, "--page-id", pageID)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Start()
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

// DeletePage 从持久化数据中删除指定页面
func (a *App) DeletePage(pageID string) error {
	appData := a.LoadData()
	if appData == nil {
		return fmt.Errorf("no data")
	}
	filtered := make([]NotePage, 0, len(appData.Pages))
	for _, p := range appData.Pages {
		if p.ID != pageID {
			filtered = append(filtered, p)
		}
	}
	appData.Pages = filtered
	delete(appData.Settings.AlwaysOnTop, pageID)
	return a.SaveData(*appData)
}
