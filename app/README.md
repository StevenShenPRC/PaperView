# PaperView Desktop App

这是 PaperView 的桌面客户端部分，基于 **Tauri** 框架构建，前端使用 **React + TypeScript + Material UI**，后端使用 **Rust**。

## 技术栈

-   **前端**: React, TypeScript, Vite
-   **UI 组件库**: Material UI (MUI)
-   **状态管理与工具**: `react-virtuoso` (虚拟滚动), `react-i18next` (多语言)
-   **后端**: Rust (Tauri), SQLite (存儲论文数据)

## 环境准备

-   Node.js (建议 v18+)
-   Rust 工具链 (Cargo)
-   Tauri 依赖项 (参考 [Tauri 官方文档](https://tauri.app/v1/guides/getting-started/prerequisites))

## 开发与构建

### 启动开发服务器

```bash
cd app
npm install
npm run tauri dev
```

### 构建生产版本

```bash
npm run tauri build
```

## 项目结构

-   `src/`: 前端 React 源代码。
-   `src-tauri/`: Rust 后端代码、Tauri 配置以及数据库接口。
-   `src/locales/`: 国际化翻译文件 (中文/英文)。
-   `src/theme.tsx`: 主题配置，集成了亮色/暗色模式逻辑。
