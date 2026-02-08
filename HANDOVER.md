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
6.  **AI & 侧边栏增强 (最新进展)**:
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

## 关键文件说明

-   `src-tauri/src/server.rs`: 处理浏览器请求的核心逻辑。
-   `src-tauri/src/db.rs`: 数据库操作与元数据更新逻辑。
-   `src-tauri/src/lib/ai.rs`: AI 并在 `network.rs` 中统一处理 HTTP 代理。
-   `src/theme.tsx`: 创建自适应主题及滚动条样式的函数。
-   `src/App.tsx`: 状态管理、主题控制及主布局。
-   `src/components/RightSidebar.tsx`: **(重点)** AI 聊天核心组件，包含 Resize/Collapse/Copy 及其状态管理逻辑。
-   `src/components/AiSettings.tsx`: AI 供应商与模型配置界面。

## 后续工作建议 (Next Steps)

1.  **验证与测试**:
    -   即便代码已修复，建议再次全流程验证：添加新供应商 -> 聊天 -> 复制 -> 历史记录切换。
    -   测试 Latex 公式在不同 Markdown 结构下的渲染（如列表中、表格中）。
2.  **UI 细节打磨**:
    -   历史记录的时间显示格式 (目前已精确到分钟，可考虑 "刚刚", "1小时前" 等相对时间)。
    -   侧边栏折叠时的动画平滑度。
3.  **功能完善**:
    -   目前 AI 翻译功能已连接后端，但需确保 Prompt 调优以获得更好的翻译质量。
    -   考虑增加 "停止生成" (Stop Generation) 按钮。
4.  **已知问题 (Potential Issues)**:
    -   曾出现 `STATUS_CONTROL_C_EXIT` 错误，若后端无故退出请检查日志。
    -   **i18n 提取**: `package.json` 中已更新 `i18n:extract` 脚本，显式指定 `--config i18next-parser.config.cjs`。配置已重命名为 `.cjs` 以兼容 ES Module 项目。

5.  **模型设置完后刷新RightSidebar**

## 注意事项

-   开发环境 Vite 配置禁用了 `fs.strict` 以兼容 OneDrive 等路径结构。
-   数据库文件默认位于 `src-tauri/papers.db`。
-   设置文件存储于 `.chat_history`, `.settings` 等 store 文件中。
