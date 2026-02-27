# `components` Directory Architecture / `components` 组件目录架构

## Overview / 概述

This directory contains the primary building blocks (React Components) of the user interface. It is divided into distinct logic boundaries representing different sections of the app: left sidebar (`Sidebar`), right AI conversational section (`RightSidebar`), the central PDF visualization feature (`PDFReader`), the central metadata/library list (`PaperList`), and application settings (`SettingsDialog`).

该目录包含构成用户界面的主要基本单元（React 组件）。它划分为代表应用程序不同部分的独特逻辑边界：左侧边栏（`Sidebar`）、右侧 AI 对话部分（`RightSidebar`）、中央 PDF 可视化功能（`PDFReader`）、中央元数据/论文库列表（`PaperList`）和应用程序设置（`SettingsDialog`）。

## Structure & Breakdown / 结构与分解

### `Sidebar/` (Left Sidebar / 左侧边栏)

Manages batch imports, local groups, and application basic navigation. 
管理批次导入、本地分组以及应用程序基础导航。

*   **`Sidebar/index.tsx`**: Main component mapping batches, groups, resizer handles, and triggering actions. / 主组件，用于映射批次、分组、调整大小的拖拽手柄以及触发相关操作。
*   **`components/BatchesAccordion.tsx`**: Dropdown module rendering imported batches (from script parsing). / 渲染导入批次（来自脚本解析）的下拉手风琴模块。
*   **`components/GroupsAccordion.tsx`**: Dropdown module rendering manually created user groups. / 渲染手动创建的用户分组的下拉手风琴模块。
*   **`components/SidebarDialogs.tsx`**: Consolidates all modal dialogs triggered by sidebar actions (renaming, creating groups, RIS mapping menus). / 整合由侧边栏操作触发的所有模态对话框（重命名、创建分组、RIS映射菜单等）。
*   **`hooks/useSidebarActions.ts`**: Encapsulates external Tauri backend calls associated with group CRUD operations or context menu operations. / 封装与分组 CRUD 操作或上下文菜单操作相关的外部 Tauri 后端调用。

### `RightSidebar/` (AI Sidebar / AI 侧边栏)

Provides an integrated AI chat interface mapped dynamically to Tauri backends.
提供了一个动态映射到 Tauri 后端的集成 AI 聊天界面。

*   **`RightSidebar/index.tsx`**: Container mapping chat history, inputs, search, and resizer functionalities. / 包含聊天历史、输入、搜索和调整大小功能的容器模块。
*   **`components/ChatHeader.tsx`**: Top navigation for toggling histories, searches, model parameters, and pinning. / 顶部导航部分，负责切换历史记录、搜索、模型参数和置顶等功能。
*   **`components/ChatMessageList.tsx`**: Robust visualizer supporting rendering complex Markdown with Code, Math plugins, and clipboard formatting controls. / 强大的可视化组件，支持通过 Code 和 Math 插件渲染复杂的 Markdown 文档，以及剪贴板格式控制。
*   **`components/ChatInputArea.tsx`**: Auto-resizing user input integrating context "chips" dropped from standard PDF interactions. / 自动调整大小的用户输入区域，整合了从标准 PDF 交互中删除的上下文“筹码”。
*   **`components/ChatSearchPanel.tsx`**: Standalone query pane scanning existing history databases via backend interactions. / 独立的查询面板组件，通过后端交互扫描现有历史数据库。
*   **`hooks/useChat.ts`**: Core processor streaming server-side event outputs (SSE equivalents over Tauri APIs) for active model chats. / 核心处理器，用于主动模型聊天的服务端事件输出数据流（Tauri API 的 SSE 等效物）。
*   **`hooks/useCopyLogic.ts`**: Standardizes converting markdown block responses into clean clipboard formats. / 将 Markdown 块响应转换为干净的剪贴板格式的标准转换处理器。

### `PDFReader/` (Document View / PDF阅读器视图)

Embedded PDF display handling dynamic rendering (`react-pdf`), annotations, jumping, and interactions.
嵌入式 PDF 显示组件，处理动态渲染（`react-pdf`）、注释、跳转和相关交互。

*   **`PDFReader/index.tsx`**: Virtualizes and manages document loading bounds and passes data down reliably into isolated pages. / 虚拟化并管理文档加载边界，同时可靠地向独立页面里下发数据。
*   **`components/PDFTopBar.tsx`**: Quick drop-down to swap PDFs belonging to the same paper entity without reloading context. / 快速下拉组件，用于在同一篇论文实体所属的 PDF 间切换而无需重新加载上下文。
*   **`components/PDFControls.tsx`**: Draggable or floating window adjusting viewer scale, layout pagination, and jumps. / 可拖拽或浮动的窗口，调整浏览器缩放、排版分页和跳转控制。
*   **`components/PDFContextMenu.tsx`**: Context overlay triggered by selecting exact text phrases for "Appends to AI Chat" contexts. / 附加上下文遮罩菜单，通过选择确切的文本触发，以附加到“AI 聊天”上下文里去。
*   **`hooks/usePdfDocument.ts`**: Buffers blob URIs converting binary Tauri loads into `react-pdf` compatible links. / 将二进制组块形态的 Tauri 数据结构下载重构为 `react-pdf` 兼容的数据链接 URIs 形态缓存。
*   **`hooks/usePdfScale.ts` & `usePdfNavigation.ts`**: Centralized logic calculations keeping scrolling bounds clamped, determining current page thresholds, and zoom limitations. / 核心逻辑运算处理方法区，保持滚动边界夹紧、判断当前页面的阈值和限焦制约。

### `SettingsDialog.tsx` & `SettingsDialog/` (Global Configurations / 全局配置)
(Refer to detailed breakdown inside `SettingsDialog.md`) / (详情请参阅 `SettingsDialog.md` 中的拆解说明)

### `PaperList/` (Library Table / 资料库表格)
(Refer to detailed breakdown inside `PaperList.md`) / (详情请参阅 `PaperList.md` 中的拆解说明)
