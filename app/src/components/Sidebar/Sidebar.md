# `Sidebar` Component Architecture / `Sidebar` 组件架构说明

## Overview / 概述

The `Sidebar/` (Left Sidebar) manages the organizational structure of the library, including navigation, paper import batches, and user-defined groups. It provides the main point of entry for exploring the paper database.

`Sidebar/`（左侧边栏）管理资料库的组织结构，包括导航、论文导入批次和用户定义的群组。它提供了探索论文数据库的主要入口点。

## Structure / 架构与模块化

*   **`Sidebar/index.tsx` (Main Container / 主容器)**
    *   Entry point representing the left navigatio column. Manages collapsible sections and resizing logic.
    *   代表左侧导航栏的入口模块。管理可收缩的部分和调整大小的逻辑。

*   **`components/BatchesAccordion.tsx`**
    *   Displays imported paper collections (batches) grouped by import events.
    *   按导入事件分组显示导入的论文集（批次）。

*   **`components/GroupsAccordion.tsx`**
    *   Displays manually created user folders/groups for organizing the library.
    *   显示用于组织资料库的手动创建的用户文件夹/群组。

*   **`components/SidebarDialogs.tsx`**
    *   Centralized location for dialogs related to sidebar actions (New Group, Rename Batch, etc.).
    *   侧边栏操作相关对话框（新群组、重命名批次等）的集中位置。

## Hooks / 业务逻辑钩子

*   **`hooks/useSidebarActions.ts`**: 
    *   Encapsulates logic for interaction with backend group storage and batch management.
    *   封装了与后端群组存储和批次管理交互的逻辑。
