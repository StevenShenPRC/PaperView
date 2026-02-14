# PaperView

<p align="center">
  <img src="./logo.svg" width="120" height="120" alt="PaperView Logo">
</p>

<p align="center">
  <strong>AI 驱动的学术论文管理与阅读助手</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Platform-Windows-blue.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Framework-Tauri-green.svg" alt="Framework">
</p>

PaperView 是一个专为科研人员打造的桌面端工具，旨在打通“文献发现 -> 文献捕捉 -> 深度阅读 -> AI 辅助”的全链路流程。它能够从浏览器一键采集论文，利用 AI 进行内容总结与问答，并提供极致流畅的 PDF 阅读体验。

---

## ✨ 核心特性

- 📥 **智能捕捉**：通过定制化的浏览器脚本，实时从 Springer、Nature 等主流期刊网站同步论文元数据。
- 🤖 **AI 强力辅助**：
  - **自动摘要与翻译**：一键生成中文标题与摘要，快速筛选关键信息。
  - **对话式问答**：基于论文内容进行深度对话，支持 Markdown 与 LaTeX 公式。
  - **智能引用 (Context Chips)**：支持在对话中引用多篇论文，悬停即可预览全文。
  - **自动标题生成**：AI 自动为对话生成简洁标题，告别“未命名对话”。
- 📖 **极致阅读体验**：
  - **三栏式布局**：侧边栏、阅读器、AI 助手同屏协作。
  - **流畅手势**：支持触摸板缩放、智能渲染挂起与平滑滚动。
  - **双语适配**：深度集成 i18n，支持中英文实时切换。
- 🔍 **混合检索架构**：基于 SQLite 的结构化管理，未来将集成 Milli 实现精准的语义+全文混合检索。
- ⚙️ **高度可定制**：
  - **供应商支持**：原生支持 OpenAI、DeepSeek、Ollama 等主流大模型。
  - **网络适配**：内置系统/自定义代理支持，复杂网络环境无忧。

---

## 🚀 成果路线图 (Roadmap)

### 已完成 (Achievements)
- [x] **Phase 1: 核心同步系统** - 浏览器脚本捕捉与后端 SQLite 同步。
- [x] **Phase 2: PDF 深度阅读** - 触摸手势、缩放优化与中/右侧栏自适应布局。
- [x] **Phase 3: AI 交互增强** - 会话持久化、多论文上下文、悬停预览预览与自动标题生成。

### 进行中 (Next Steps)
- [ ] **语义搜索 (Phase 4)** - 引入 Milli 实现更加精准的混合检索。
- [ ] **知识库图谱** - 基于论文引用的可视化管理。
- [ ] **管理引文** - 与其他文献管理软件（Zotero?）的互联。
- [ ] **跨平台支持** - 支持 Windows、Linux、MacOS.

---

## 🛠️ 快速开始

### 1. 安装与运行
1. 下载最新的Pre-release版本 
   - `PaperView_0.1.0_x64-setup.exe`
2. 安装后启动应用。
   - 目前仅支持Windows 

### 2. 配置浏览器扩展
PaperView 导入文献需要与浏览器脚本协作：
1. 安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)。
2. PaperView 启动后，点击左侧边栏底部的 **"JS"** 按钮一键安装，或在应用运行时直接访问 `http://localhost:{$port}/paperview.user.js` 进行安装（默认端口为8080，可在设置中自定义）。
3. 在支持的期刊网站，点击底部面板的 **"Sync All"** 即可开始同步。
    - 支持列表：

| 出版商 | 页面 |
| :--- | :--- |
| Spr\*\*ger Nat\*re | `https://link.spr**ger.com/journal/**/volumes-and-issues/***` |
|Els\*\*ier Sci\*\*ceDirect|`https://www.sci**cedirect.com/journal/***/vol/***/issues/`|
|正在适配|………………|

### 3. AI 提供商设置
前往 **“设置 -> AI 设置”**：
- 输入你的 API Key 和 Base URL (OpenAI Compatible).
- 点击刷新按钮获取可用模型列表。
- 勾选激活后，即可在右侧 AI 栏开始对话。

---

## 📐 技术架构

```mermaid
graph TD
    A[Browser / Journal Sites] -->|POST Paper Data| B(Tauri Rust Backend)
    B -->|Persist| C[(SQLite DB)]
    B -->|Serve JS| A
    B -->|Event Emit| D[React Frontend]
    D -->|Chat / Read / Search| B
    B -->|API Request| E[AI Providers: DeepSeek/Ollama/...]
```

---

## 👩‍💻 开发与贡献

如果你希望参与开发：

```bash
cd app
npm install
npm run tauri dev
```

---

## 📝 许可证

本项目采用 [GPLv3](LICENSE) 许可协议。
