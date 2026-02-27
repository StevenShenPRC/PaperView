# `src` Directory Architecture & Documentation / `src` 目录架构说明

## Overview / 概述

This directory (`app/src`) is the root of the React application's frontend. It wires up the global application state, coordinates between the main components (the sidebar, the paper list, the PDF reader, and the right AI sidebar), handles top-level routing or conditional rendering, and manages the global Tauri events.

该目录（`app/src`）是 React 应用程序前端的根目录。它连接了全局应用程序状态，在主要组件（侧边栏、论文列表、PDF阅读器和右侧AI侧边栏）之间进行协调，处理顶层路由或条件渲染，并管理全局 Tauri API 事件。

## Files & Components / 文件与组件列表

### `App.tsx`

`App` is the central root component. It oversees the main layout structure of the application and delegates data logic downward. It was recently refactored to extract business logic into custom hooks, ensuring that the file primarily handles the visual architecture (UI layout) instead of complex state management.

`App` 是核心的根组件。它负责监控应用程序的主要布局结构，并将数据逻辑向下层委派。它最近被重构，将业务逻辑提取到自定义 Hook 中，以确保该文件主要处理视觉架构（UI布局），而不是复杂的状态管理。

#### State Managers (via Custom Hooks) / 状态管理器（通过自定义 Hook）
*   `useAppNotifications()`: Handles global alert snackbars (`showSnackbar`) and rate limit warning dialogs (`showRateLimitError`). / 处理全局警告提示框（`showSnackbar`）和频率限制警告对话框（`showRateLimitError`）。
*   `useAppData()`: Centralizes data fetching from Tauri for batches, groups, and papers (`loadBatches`, `refreshPapersForBatch`). Also listens to Tauri events like `data-updated` and `paper-updated`. / 集中处理从 Tauri 获取批次、分组和论文的数据逻辑，并监听诸如 `data-updated` 和 `paper-updated` 等全局事件。
*   `usePaperActions()`: Delegates paper-related interactions such as translating, moving between groups, and querying metadata. / 委派与论文相关的交互操作，例如翻译、在分组中移动、查询元数据等。
*   `useAppLayout()`: Controls layout behaviors like opening/collapsing sidebars (`setSidebarCollapsed`), toggling the PDF reader (`handleReadPdf`, `handleCollapseReader`), and handling user resizer events for the main display boxes. / 控制布局行为，例如侧边栏展开/折叠、切换 PDF 阅读器，以及处理主显示框的用户拖拽调整大小事件。
*   `useFileDrop()`: Used for handling `.ris` file imports via drag-and-drop globally or directly into specific zones. / 用于处理通过全局拖放或直接拖放到指定区域的 `.ris` 文件导入功能。

#### Sub-components Layout / 子组件布局划分
The layout rendered by `App.tsx` essentially follows a three-panel design:
由 `App.tsx` 渲染的布局本质上遵循三面板设计：
1.  **Left Sidebar (`<Sidebar />`)**: Navigation for batches and local groups. / 左侧边栏：用于批次和本地分组导航。
2.  **Middle/Main View**: Divided conditionally. Usually displays the `<PaperList />`. When a PDF is being analyzed, the layout accommodates the `<PDFReader />` alongside the list (or collapses the list depending on view limits). / 居中/主视图：根据条件分割，通常显示论文列表。当分析PDF时，该布局会容纳 PDF 阅读器并与列表并排展示。
3.  **Right Sidebar (`<RightSidebar />`)**: Dedicated area for AI context chats and tools. / 右侧边栏：专门用于 AI 聊天和相关工具的区域。

### `main.tsx`

Entry point initializing the React runtime and rendering `App`. Attaches context providers for Dialogs and Themes. / 初始化 React 运行时并渲染 `App` 的入口文件。附加了对话框和主题的上下文提供者。

### `types.ts`

Defines TypeScript interfaces and types universally used across the frontend, ensuring strong typing between backend responses and React states (e.g., `Paper`, `Batch`, `Group`, `PaperPdf`, `PendingContext`). / 定义了前端普遍使用的 TypeScript 接口和类型，确保后端响应和 React 状态之间的强类型约定（如论文、批次、PDF结构等）。

### `vite-env.d.ts`

Type definitions for Vite. / Vite 的类型定义文件。

## Sub-directories / 子目录

*   **`components/`**: Houses all standard UI elements. / 存放所有标准 UI 元素。
*   **`hooks/`**: Central location for reusable logic hooks. / 可复用逻辑 Hook 的集中地。
*   **`context/`**: React Context providers for global theme, dialog, and settings data. / React Context 提供者，用于全局主题、弹窗和设置数据。
*   **`locales/`**: JSON localization files (i18n). / 多语言 JSON 本地化文件 (i18n)。
*   **`utils/`**: Helper methods and functional logic decoupled from components. / 与组件解耦的辅助方法和纯函数逻辑。
