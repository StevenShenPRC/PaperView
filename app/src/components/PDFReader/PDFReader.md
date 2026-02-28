# `PDFReader` Component Architecture / `PDFReader` 组件架构说明

## Overview / 概述

The `PDFReader/` component provides the core document viewing experience within the application. It leverages `react-pdf` for rendering and integrates custom hooks and components for navigation, scaling, and context-aware interactions like selecting text to send to AI.

`PDFReader/` 组件提供了应用程序中的核心文档查看体验。它利用 `react-pdf` 进行渲染，并集成了用于导航、缩放和上下文感知交互（例如选择文本发送给 AI）的自定义钩子和组件。

## Structure / 架构与模块化

*   **`PDFReader/index.tsx` (Main Viewer / 主阅读器入口)**
    *   Handles the overall layout of the PDF viewer, virtualization, and coordinates between the document loader and individual page renderers.
    *   负责 PDF 阅读器的整体布局、虚拟化，并协调文档加载器与各页面渲染器。

*   **`components/PDFTopBar.tsx`**
    *   Renders the title and allows switching between different PDF files associated with the same paper entity.
    *   渲染标题，并允许在与同一论文实体关联的不同 PDF 文件之间进行切换。

*   **`components/PDFControls.tsx`**
    *   Floating or fixed control bar for zoom (scale), page navigation, and layout adjustments.
    *   用于缩放、页面导航和布局调整的悬浮或固定控制栏。

*   **`components/PDFContextMenu.tsx`**
    *   Custom context menu allowing users to take actions on selected text, such as "Add to AI Context".
    *   自定义右键菜单，允许用户对选定文本执行操作，例如“添加到 AI 上下文”。

## Hooks / 业务逻辑钩子

*   **`usePdfDocument.ts`**: Initializer for loading the PDF blob/file from the backend. / 用于从后端加载 PDF blob/文件的初始化逻辑。
*   **`usePdfNavigation.ts`**: Manages current page state and jump logic. / 管理当前页码状态和跳转逻辑。
*   **`usePdfScale.ts`**: Controls zoom levels and responsive scaling. / 控制缩放级别和响应式比例。
*   **`usePdfContextMenu.ts`**: Logic for extracting selection coordinates and managing menu visibility. / 提取选择坐标并管理右键菜单可见性的逻辑。
