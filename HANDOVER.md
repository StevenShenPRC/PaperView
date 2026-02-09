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
    -   **0.0.1-alpha.1**: (最新) 更新了全线版本号（`Cargo.toml`, `tauri.conf.json`, `paperview.user.js`），统一为 `0.0.1-alpha.1`。
9.  **视觉与身份标识 (Visual Identity)**:
    -   **动态图标**: 实现了 `window_icon.rs` 模块，窗口图标根据系统主题（亮色/暗色）动态切换。
    -   **侧边栏 Logo**: 侧边栏顶部新增 Logo 图标，支持根据应用主题自动切换亮暗版本。
10. **浏览器集成与配置 (Browser Script & Config)**:
    -   **脚本分发**: 后端现已嵌入并提供浏览器脚本服务 (`GET /paperview.user.js`)。
    -   **安装链接**: 侧边栏新增 "JS" (Install Script) 按钮，一键调起浏览器安装脚本。
    -   **连接设置**: 后端服务端口改为可配置（默认 8080），修改后提示用户重启应用。
    -   **导出配置**: 设置界面新增“导出配置文件”功能，支持将当前所有设置导出为 JSON。

## 关键文件说明

-   `src-tauri/src/server.rs`: 处理浏览器请求的核心逻辑，新增 `/paperview.user.js` 路由。
-   `src-tauri/src/db.rs`: 数据库操作与元数据更新逻辑。
-   `src-tauri/src/window_icon.rs`: **(新增)** 处理跨平台窗口图标动态切换逻辑。
-   `src-tauri/assets/`: **(新增)** 存放静态资源（如浏览器脚本）。
-   `src/components/Sidebar.tsx`: **(增强)** 支持 Mini 模式、Logo 显示、脚本安装链接。
-   `src/components/RightSidebar.tsx`: AI 聊天核心组件，包含 Resize/Collapse/Copy 状态管理。

## 后续工作建议 (Next Steps)

1.  **验证与测试**:
    -   再次全流程验证：修改端口 -> 重启 -> 点击侧边栏 JS -> 验证浏览器打开的地址是否正确。
2.  **UI 细节打磨**:
    -   Logo 在侧边栏折叠时的显示优化。
    -   导出配置后的导入功能（目前仅支持导出）。
3.  **功能完善**:
    -   目前 AI 翻译功能已连接后端，但需确保 Prompt 调优以获得更好的翻译质量。
    -   考虑增加 "停止生成" (Stop Generation) 按钮。

## 注意事项

-   开发环境 Vite 配置禁用了 `fs.strict` 以兼容 OneDrive 等路径结构。
-   数据库文件默认位于 `src-tauri/papers.db`。
-   `plugin-opener` v2 导入函数名为 `openUrl`，不再是 `open`。
-   i18n 提取脚本已更新为 `i18n:extract`，需使用 `.cjs` 配置文件。
