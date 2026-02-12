# PaperView 项目交接文档 (HANDOVER)

本文件旨在为新开启的对话上下文提供项目当前状态的快速概览。

## 项目现状概览

PaperView 是一个论文同步与管理系统，允许用户从浏览器捕捉论文并同步到本地数据库。

-   **技术栈**: Tauri (Rust), React (TypeScript), Material UI, SQLite.
-   **核心流程**: 浏览器脚本 -> HTTP POST -> Rust 后端 -> SQLite -> 前端 (事件驱动刷新)。

## 已完成的功能

1.  **架构搭建**: 完整的 Tauri + Vite + React 架构，解决了 Windows 下 Junction 路径的 Vite 加载问题。
2.  **数据同步**: 
    -   `BrowserScript/paperview.user.js` 可捕捉页面论文并推送到后端端口。
    -   Rust 后端实现多线程 HTTP 服务，支持跨域同步。
3.  **元数据增强**: 
    -   支持 DOI 自动更新，从 CrossRef 获取卷号、期号、出版日期等。
    -   DB 层级自动去重并触发事件。
4.  **UI/UX 优化**:
    -   **虚拟列表**: 使用 `react-virtuoso` 实现海量数据的流畅滚动。
    -   **侧边栏**: 可折叠 Mini 模式，支持期刊名称自动换行与加粗。
    -   **主题系统**: 完整的亮色/暗色/跟随系统模式适配，包括自定义滚动条。
    -   **国际化**: 支持中英文切换 (`react-i18next`)。
5.  **实时性**: 后端通过 Tauri Event 处理 `data-updated` 和 `paper-updated` 事件，前端实时响应。
6.  **AI & 侧边栏增强**:
    -   **侧边栏交互**: 
        -   支持拖拽调整宽度 (Min: 300px, Max: 800px)。
        -   支持折叠/展开，折叠后显示 Mini 图标栏。
    -   **聊天历史**: 
        -   实现历史记录列表，支持删除与切换。
        -   时间戳精确到分钟。
    -   **高级复制**: 
        -   消息气泡增加 "Sticky" 复制按钮，长消息滚动不消失。
        -   右键菜单支持：复制文本、复制 Markdown、设置默认格式。
    -   **设置增强**: 
        -   完整支持 OpenAI/DeepSeek/Ollama 等多供应商配置。
        -   支持自定义 HTTP Header (用于特殊 API 验证)。
        -   支持网络代理 (System/Custom Proxy) 切换。
7.  **元数据增强 (Fallback & UI)**:
    -   **多数据源**: 实现了 DOI -> CrossRef -> Semantic Scholar -> Springer Crawler 的多级回退机制。
    -   **爬虫增强**: 针对 Springer 实现了直接网页抓取，包含 Request Header 伪装。
    -   **风控处理**: 
        -   后端实现 1s/10m/100h 三级速率限制。
        -   前端区分普通错误与风控错误，通过模态对话框 (Dialog) 提示用户并在界面显示加载动画。
8.  **发布记录**:
    -   **0.1.0-alpha.0**: 完成了首个 alpha 版本的编译发布，包含全链路版本同步与 i18n 提取。解决了 MSI 版本号格式限制问题（需为纯数字）。
    -   **0.0.1-alpha.1**: 更新了全线版本号，统一为 `0.0.1-alpha.1`。
    -   **0.0.2-alpha.0**: (最新) 完成了 Phase 2 核心阅读器体验优化。支持 PDF 缩放手势、布局调整、输入增强、稳定性修复以及右侧栏常驻改造。
9.  **视觉与身份标识 (Visual Identity)**:
    -   **动态图标**: 实现了 `window_icon.rs` 模块，窗口图标根据系统主题（亮色/暗色）动态切换。
    -   **侧边栏 Logo**: 侧边栏顶部新增 Logo 图标，支持根据应用主题自动切换亮暗版本。
10. **浏览器集成与配置**:
    -   **脚本分发**: 后端现已嵌入并提供浏览器脚本服务 (`GET /paperview.user.js`)。
    -   **安装链接**: 侧边栏新增 "JS" (Install Script) 按钮，一键调起浏览器安装脚本。
11. **PDF 阅读器与布局 (Phase 2)**:
    -   **布局重构**: 实现了左(PaperList) + 中(PDFReader) + 右(AI Sidebar) 的三栏布局。
    -   **可调整宽度**: PDF 阅读器支持拖拽调整宽度，并实现了智能渲染挂起（Resize 时暂停渲染）以提升性能。
    -   **交互优化**:
        -   **手势缩放**: 支持 Ctrl+滚轮 / 触摸板捏合缩放，步长锁定 10%，防抖动。
        -   **输入增强**: 页码/缩放比例输入框支持一键全选，输入体验流畅。
        -   **稳定性**: 修复了 Scrollbar 引起的布局抖动，修复了 Text Layer 选区高度与文字不重合的问题（视觉欺骗方案）。
    -   **收起模式**: PDF 关闭按钮改为“收起”，触发时释放资源但保留引用；右侧栏常驻显示，收起 PDF 后可一键重新打开。
    -   **右侧栏改造**: 始终常驻，收起时移除 New Chat 按钮，仅在关联 PDF 时显示“打开阅读器”按钮。
66: 
67: 12. **搜索架构优化 (Phase 2.5)**:
68:     -   **向量搜索增强**: 
69:         -   后端引入 `distance_threshold` (0.8) 过滤低相关结果。
70:         -   实现了**相对差值过滤**策略 (Relative Difference Filtering)，大幅提升搜索纯度。
71:     -   **全文搜索 (FTS5) 尝试**:
72:         -   在 SQLite 中集成了 FTS5 虚拟表及触发器，实现了 RAG + FTS 双重搜索展示。
73:         -   **现状**: 因 FTS5 对 CJK (中文) 分词支持不佳，且扩展集成复杂，已**搁置**该方案。
74:         -   **未来路线**: 已确定迁移至 **Hybrid Architecture (SQLite + Milli)**，使用 Milli 解决中文搜索与混合检索问题。

## 关键文件说明

-   `src-tauri/src/server.rs`: 处理浏览器请求的核心逻辑，新增 `/paperview.user.js` 路由。
-   `src-tauri/src/db.rs`: 数据库操作与元数据更新逻辑。
-   `src-tauri/src/window_icon.rs`: 处理跨平台窗口图标动态切换逻辑。
-   `src/components/PDFReader.tsx`: **(核心)** 基于 `react-pdf` 封装，包含自定义 Toolbar、缩放逻辑、虚拟化渲染优化及手势支持。
-   `src/components/RightSidebar.tsx`: **(增强)** 适配了常驻布局，接收 `hasCollapsedPdf` 属性控制按钮显示。
-   `src/App.tsx`: **(中枢)** 管理 `pdfCollapsed` 状态，控制 PaperList/PDFReader/Sidebar 的布局宽度分配与显隐逻辑。
-   `src/App.css`: **(Hack)** 包含针对 react-pdf TextLayer 的关键 CSS 修正（视觉欺骗方案），确保选区对齐。

## 踩坑与注意事项 (Gotchas)

1.  **React-PDF Text Layer 对齐**: 
    -   `react-pdf` 使用精确的 `transform` 定位文字。
    -   **绝对不要** 全局修改 `span` 的 `display` 或 `height`，这会破坏定位。
    -   **解决方案**: 将文字颜色设为透明，使用 `::selection` 的 `mix-blend-mode: multiply` 来模拟高亮，同时重置 `line-height: 1`。
    -   **注意**: 必须在 `main.tsx` 中显式 `import './App.css'`，否则 CSS 不生效（曾导致调试困惑）。

2.  **PDF 缩放抖动**:
    -   滚轮事件触发频率极高。
    -   **解决方案**: 使用累积阈值法（Accumulator）+ 10% 步长锁定，过滤掉微小的抖动输入。

3.  **Tauri 资源释放**:
    -   PDF 阅读器组件较重。
    -   **策略**: “收起”操作应触组件卸载 (`unmount`) 以释放内存，而不是简单的 `display: none`。重新打开时重新挂载。

4.  **开发环境 Vite**: 禁用了 `fs.strict` 以兼容 OneDrive 路径。
5.  **Winddows 版本号**: 构建 MSI 时版本号必须是 `x.x.x` 格式，不能带 `-alpha` 等后缀，否则构建会失败。

## 后续工作建议 (Next Steps)

1.  **AI Context (Phase 3)**:
    -   实现 PDF 选词后的 Context Menu (Explain/Ask/Translate)。
    -   后端接入 rust 端的 PDF 文本提取能力。
2.  **验证与测试**:
    -   全流程验证：Attach PDF -> Read -> Resize -> Collapse -> Reopen。

