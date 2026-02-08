# PaperView

**AI 驱动的学术论文管理与阅读助手**

PaperView 是一个桌面应用，帮助你从学术期刊网站捕捉论文，并利用 AI 进行翻译和对话式问答。

---

## 🚀 快速开始

### 1. 安装应用

运行安装包：
- `PaperView_x.x.x_x64-setup.exe` (Windows)

### 2. 配置浏览器脚本

1.  安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2.  打开 `BrowserScript/paperview.user.js`，复制全部内容。
3.  在 Tampermonkey 中创建新脚本，粘贴并保存。
4.  在支持的期刊网站（如 Springer, Nature 等）页面底部会出现同步面板。

### 3. 同步论文

1.  确保 PaperView 应用正在运行。
2.  浏览期刊目录页，点击脚本面板中的 **"Sync All"** 按钮。
3.  论文会自动同步到 PaperView 应用中。

---

## ⚙️ 功能配置

### AI 对话与翻译

1.  打开应用设置 (左下角齿轮图标)。
2.  切换到 **"AI 设置"** 页签。
3.  点击 **"添加"** 配置 AI 提供商：
    -   **名称**: 自定义名称 (如 "DeepSeek")
    -   **Base URL**: API 端点 (如 `https://api.deepseek.com`)
    -   **API Key**: 你的密钥
    -   **模型**: 点击刷新按钮自动获取，或手动添加
4.  开启开关激活该提供商。

### 网络代理

如需代理，在 **"网络"** 页签中配置：
-   **系统代理**: 使用系统设置
-   **自定义代理**: 输入代理地址 (如 `socks5://127.0.0.1:7890`)

---

## 📖 使用指南

### 论文浏览

-   **左侧栏**: 按期刊/卷号分组的论文列表
-   **主区域**: 论文详情，包括标题、摘要
-   **右侧 AI 栏**: 与 AI 对话，可基于选中论文提问

### 元数据更新

点击论文右上角的 **刷新图标**，自动从 DOI 获取完整元数据（标题、摘要等）。

### AI 翻译

点击论文的 **翻译按钮**，将标题和摘要翻译为中文。

### AI 对话

在右侧栏输入问题并发送，AI 会基于上下文回答。支持 Markdown 和 LaTeX 公式渲染。

---

## 🛠️ 开发者指南

### 环境要求

-   Node.js 20+
-   Rust 1.70+
-   npm 9+

### 本地开发

```bash
cd app
npm install
npm run tauri dev
```

### 构建发布版

```bash
npm run tauri build
```

安装包生成在 `src-tauri/target/release/bundle/` 目录下。

---

## 📝 许可证

