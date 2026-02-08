# PaperView 项目交接文档 (HANDOVER)

本文件旨在为新开启的对话上下文提供项目当前状态的快速概览。

## 项目现状概览

PaperView 是一个论文同步与管理系统，允许用户从浏览器捕捉论文并同步到本地数据库。

-   **技术栈**: Tauri (Rust), React (TypeScript), Material UI, SQLite.
-   **核心流程**: 浏览器脚本 -> HTTP POST -> Rust 后端 -> SQLite -> 前端 (事件驱动刷新)。

## 已完成的功能

1.  **架构搭建**: 完整的 Tauri + Vite + React 架构，解决了 Windows 下 Junction 路径的 Vite 加载问题。
2.  **数据同步**: 
    -   `BrowserScript/paperview.user.js` 可捕捉页面论文并推送到 `localhost:8080`。
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

## 关键文件说明

-   `src-tauri/src/server.rs`: 处理浏览器请求的核心逻辑。
-   `src-tauri/src/db.rs`: 数据库操作与元数据更新逻辑。
-   `src/theme.tsx`: 创建自适应主题及滚动条样式的函数。
-   `src/App.tsx`: 状态管理、主题控制及主布局。
-   `src/components/PaperList.tsx`: 核心展示列表（含虚拟滚动）。

## 后续工作建议

1.  **AI 翻译**: 目前界面上有“翻译”按钮但仅为占位符。后端需要集成 OpenAI 兼容接口实现摘要翻译。
2.  **AI 助手**: 右侧边栏 UI 已就绪，但尚未连接到实际的后端对话逻辑。
3.  **设置持久化**: 目前主题和设置存储在内存中，刷新会重置，建议引入 `tauri-plugin-store` 或使用 localStorage。
4.  **自动化同步**: 考虑支持自动触发元数据抓取，而不是手动点击更新。

## 注意事项

-   开发环境 Vite 配置禁用了 `fs.strict` 以兼容 OneDrive 等路径结构。
-   数据库文件默认位于 `src-tauri/papers.db`。
