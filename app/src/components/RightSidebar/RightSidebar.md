# `RightSidebar` Component Architecture / `RightSidebar` 组件架构说明

## Overview / 概述

The `RightSidebar/` component houses the AI-driven conversational interface. It facilitates multiple chat sessions, real-time message streaming from various LLM providers, and context-aware interaction using paper metadata and PDF snippets.

`RightSidebar/` 组件包含 AI 驱动的对话界面。它支持多个聊天会话、来自各种 LLM 提供商的实时消息流，以及使用论文元数据和 PDF 片段的上下文感知交互。

## Structure / 架构与模块化

*   **`RightSidebar/index.tsx` (Main Sidebar Container / 主侧边栏容器)**
    *   Coordinates session management, message history loading, and input handling. Manages the internal layout of the chat interface.
    *   协调会话管理、消息历史加载和输入处理。管理聊天界面的内部布局。

*   **`components/ChatHeader.tsx`**
    *   Contains history navigation, session deletion, and **Model Selection**. 
    *   **New Update**: Now supports provider-model decoupling, allowing users to select models grouped by their provider.
    *   包含历史导航、会话删除和**模型选择**。
    *   **最新更新**：现在支持提供商-模型解耦，允许用户按提供商分组选择模型。

*   **`components/ChatMessageList.tsx`**
    *   Renders the conversation flow with support for Markdown, LaTeX (math), and syntax-highlighted code blocks.
    *   渲染对话流，支持 Markdown、LaTeX（数学公式）和带语法高亮的代码块。

*   **`components/ChatInputArea.tsx`**
    *   The primary input field for the user, integrating multi-line support and context chips handling.
    *   用户的主要输入字段，集成了多行支持和上下文筹码（chips）处理。

## Hooks / 业务逻辑钩子

*   **`hooks/useChat.ts`**: 
    *   Core logic for interfacing with Tauri-based LLM backends. Handles initialization, session switching, and streaming responses.
    *   **Update**: Refactored to handle global provider-model routing and multi-provider selection.
    *   与基于 Tauri 的 LLM 后端交互的核心逻辑。处理初始化、会话切换和响应。
    *   **更新**：重构以处理全局提供商-模型路由和多提供商选择。
*   **`hooks/useChatSearch.ts`**: Logic for searching through chat history sessions. / 搜索聊天历史会话的逻辑。
*   **`hooks/useCopyLogic.ts`**: Handles clean text extraction and clipboard operations for LLM responses. / 处理 LLM 响应的纯文本提取和剪贴板操作。
*   **`hooks/useSidebarResize.ts`**: Manages the draggable width expansion of the sidebar. / 管理侧边栏可拖动的宽度扩展逻辑。
