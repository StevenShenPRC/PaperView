# `settings` Component Architecture / `settings` 配置设置组件架构

## Overview / 概述

This directory structures the global application settings window (`SettingsDialog`), handling persistent configurations, API keys, proxy parameters, backend LLM providers, user experience themes, and data path validations.

此目录构建了全局应用程序设置面板（`SettingsDialog`），负责处理持久化用户配置信息，涉及 API 密钥、网络层代理参数、后端大型语言模型提供商、前端界面展示主题方案，以及持久化数据存储路径验证。

## Structure / 架构与模块化

The main `SettingsDialog` has been decoupled structurally using inner routing patterns within the dialog to accommodate different setting categories dynamically without cluttering one massive scrollable file.
出于结构化的考虑将主对话框组件做了进一步分解。采取了内部路由范式以满足在面板内自由切换多样化的配置功能，杜绝了塞满整篇、庞大且不易维护的文件设计。

*   **`components/SettingsDialog.tsx` (Main Dialog Wrapper / 主对话框封装层)**
    *   Initiates the overarching Modal overlay handling. Renders the left-side vertical category tabs and displays the targeted tab component on the right.
    *   实现外层模态弹出与拦截。在侧边渲染出分类标签，并在右侧控制相应配置表单页面的热拔插显示。
    *   Connects universally via Tauri plugin Store APIs fetching basic persistent profiles via standard `useSettings` logic or `invoke`.
    *   通过标准的 Tauri Store 后端插件，读取基础通用的持久化个人用户基础信息集（经由内建的 `useSettings` 指令封装或 `invoke` 请求实现）。

*   **`SettingsDialog/GeneralSettings.tsx`**
    *   Controls generic cross-cutting behaviors: "Dark/Light mode switch", language, default paper save paths, auto-updates.
    *   定义并控制通用的交叉型系统规则集：主题明暗方案转换触发；系统偏好语种选择；默认论文索引抓取下传的目录位置；自动化更迭轮询检查等。

*   **`SettingsDialog/NetworkSettings.tsx`**
    *   Handles local/global proxy definitions (HTTP/HTTPS, SOCKS5). Vital for accessing specific academic metadata databases outside regional boundaries via Tauri's decoupled Rust connections.
    *   专用于解决本地亦或是远端全域的代理定义映射功能块（含 HTTP/HTTPS 端口号处理; SOCKS5）。该关键网关是保证程序能通过 Tauri Rust 底层去解耦、进而跨越地缘边界抓取指定学术库数据的必需途径。

*   **`SettingsDialog/AISettings.tsx`**
    *   Key orchestration module managing LLM API credentials. Configures OpenAI / Claude / Ollama backend nodes mapped locally or globally, context thresholds, and generative capabilities per model setup.
    *   主导 LLM 模型及各类智能API令牌密钥流转与鉴权的核心模块阵列构件。处理适配并映射诸如源于 OpenAI、Claude 或是依托本地运算节点的资源池（如搭载 Ollama 基底的接口通道）及其相关的超分阈值判定参数集和基于所选节点的独特生成向度配置体系群。
