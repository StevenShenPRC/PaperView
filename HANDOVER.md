# PaperView 项目交接文档 (HANDOVER)

本文件旨在为新开启的对话上下文提供项目当前状态的快速概览。

## 项目现状概览

PaperView 是一个论文同步与管理系统，允许用户从浏览器捕捉论文并同步到本地数据库。

-   **技术栈**: Tauri (Rust), React (TypeScript), Material UI, SQLite.
-   **核心流程**: 浏览器脚本 -> HTTP POST -> Rust 后端 -> SQLite -> 前端 (事件驱动刷新)。

## 已完成的功能 (主要阶段总结)

1.  **架构搭建**: 完整的 Tauri + Vite + React 架构，解决了 Windows 下 Junction 路径的 Vite 加载问题。
2.  **数据同步与管理**: 
    -   ` BrowserScript/paperview.user.js` 可捕捉页面论文并推送到后端。
    -   Rust 后端使用 SQLite 实现数据持久化，支持 DOI 自动更新与去重。
    -   实现了**批次 (Batches)** 和 **我的组 (My Groups)** 管理系统。
3.  **UI/UX 深度打磨**:
    -   **虚拟列表**: 使用 `react-virtuoso` 实现海量数据的流畅滚动。
    -   **侧边栏交互**: 支持折叠/展开、左右拖拽调整宽度。折叠模式下完美对齐三横按钮。
    -   **主题系统**: 完整的亮色/暗色/跟随系统模式适配。
    -   **国际化**: 深度集成 `react-i18next`，支持中英文实时切换及 i18n 自动提取维护。
4.  **AI 聊天与上下文 (Phase 3)**:
    -   **会话管理**: 全新 SQLite 会话表，支持历史记录持久化、删除与多会话切换。
    -   **自动标题**: 基于 AI 总结对话生成标题，并实现自动兜底逻辑（AI 失败时提取首句摘要）。
    -   **上下文引用 (Chips)**: 引入 Chips 布局，支持垂直堆叠展示引用论文，并实现全量全文悬停预览。
    -   **输入增强**: 修复多行输入 Placeholder 对齐问题，优化展开/收起按钮布局。
5.  **PDF 阅读器体验 (Phase 2)**:
    -   支持 Ctrl+滚轮 / 触摸板手势缩放。
    -   实现智能渲染挂起与 PDF 收起状态驻留（释放 PDF 资源但保留 UI 引用）。
    -   针对 react-pdf TextLayer 实现视觉对齐修正。

## 发布记录

-   **0.1.0**: (最新) 首个 Pre-release 版本。统一版本号，完成了 Phase 3 AI 增强与侧边栏体验的完整打磨。
-   **0.0.2-alpha.0**: 完成了 Phase 2 核心阅读器体验优化。
-   **0.0.1-alpha.1**: 完成了基础数据的全链路同步与 i18n 系统。

## 关键文件说明

-   `src-tauri/src/ai.rs`: 处理 AI 请求、Prompt 模板及标题自动生成逻辑。
-   `src-tauri/src/db.rs`: 核心 SQLite 操作，包含 Paper, Session, Messages 的所有 CRUD。
-   `src/components/RightSidebar.tsx`: AI 消息气泡、会话列表、Context Chips 悬停预览的主要实现。
-   `src/components/Sidebar.tsx`: 管理批次与分组，包含侧边栏在不同拉伸状态下的样式自适应逻辑。
-   `src/components/PDFReader.tsx`: 基于 `react-pdf` 封装，包含手势支持与 Toolbar 交互。

## 踩坑与注意事项 (Gotchas)

1.  **MUI AccordionSummary 宽度塌陷**: 
    -   在侧边栏折叠模式下，`AccordionSummary` 的 content 部分极易塌陷为 0px。
    -   **必须** 显式设置 `width: '100%'` 并移除默认的 `m: 0` (margin) 才能实现真正的居中与撑开。
2.  **AI 标题生成不稳定性**:
    -   部分模型（如经由代理的 Gemini）对 Prompt 敏感，可能返回空字符串或特殊字符。
    -   **解决方案**: 前端必须实现基于 `content.substring(0, 30)` 的强力兜底逻辑。
3.  **Windows 版本号限制**: 制作安装包时，版本号字段**仅允许数字和小数点**（如 0.1.0），不要传入带 alpha/beta 的字符串。
4.  **样式穿透 (react-pdf)**: 修改 PDF 文字选区背景必须在全局 CSS 中使用特定的层级选择器（见 `App.css`），否则会被内联样式覆盖。

## 后续工作建议 (Next Steps)

1.  **PDF 深度交互**: 
    -   在 PDF 选区实现右键菜单（解释、翻译、摘录到笔记）。
    -   支持在 PDF 内部进行 OCR（如果 PDF 本身不可选）。
2.  **批量元数据更新**:
    -   实现 UI 层的批量全选 -> 更新元数据逻辑。
3.  **Milli/Hybrid 搜索**: 
    -   按计划引入 Milli 解决中文分词全文检索问题，实现 Vector + FTS 的混合检索。
