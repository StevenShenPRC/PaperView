# `hooks` Directory Architecture / `hooks` 定制化业务逻辑隔离架构

## Overview / 概述

The components are intentionally decoupled from top-level state management to avoid bloated React files (`App.tsx` handling 600+ lines). The `hooks` directory isolates domain-specific pure functional logic (state machines, listeners, and generic wrappers) to ensure React render cycles remain clean and well-structured.

组件在架构上被刻意地同最高层级的业务全览型状态处理机制隔绝开来，以规避引发类似于（`App.tsx` 里挤满多达 600 多行处理）的 React 页面结构膨胀弊病。`hooks` 目录专栏负责切断并隔离特定商业领域下原本会依附并拖垮组件内的纯功能性代码流（这些通常是：系统层监听器流，状态维护重包层）。此举充分保障了界面端的 React 生命周期函数能够在整洁强健且明确定义的逻辑架构图景下纯粹渲染。

## Hook Breakdowns / 业务分类解析

*   **`useAppData.ts`**: The core global system data entry logic hooking onto initial local database requests (Batches, User Profiles). Registers multi-channel Tauri app signals dynamically responding to backend pushes to synchronize state automatically.
    *   作为牵涉本地 SQLite 数据加载全域的核心钩子处理流（例如批次和各色档案表数据源提取）。它能无缝通过侦听绑定了各种系统底层多向频道化推送反馈流动的事件通道，利用基于 Tauri 后端所激发推送动作的智能反应进而实现了页面上的数据自动化层层级联及状态对冲更新流映射。
*   **`useAppLayout.ts`**: Keeps UI width resizers, responsive reader toggles, and multi-component collapsed states synchronized globally using simple declarative methods.
    *   提供一套基于单纯命令式解耦思想的全域配置结构群，在宏观层维持保障了动态主页面布局拉扯框及随动变化视窗伸缩宽度数值的安全同步，进而联动多项侧翼组块状态展开/掩藏切换判定流程的自然接合流利度。
*   **`useAppNotifications.ts`**: Small isolated slice responsible for spawning generic "Snackbars" (non-blocking toast notifications) or "Rate Limit Alerts".
    *   非常纯净简短地将独立处理碎片信息吐出操作抽逃了出来——专注于快速启动非干预系统底层流运转的基础弱交互（气泡快显），及严重阈值熔断级别硬警示弹窗逻辑模块集成。
*   **`usePaperActions.ts`**: Aggregates highly specific external endpoint requests associated to main table outputs like PDF fetching wrappers, automated translated texts fetching, grouping CRUD triggers.
    *   将高度定置指向型极强，与外部端点（或是核心业务库接口流关联度高）的各类功能诉求命令打包装载。直接囊括在诸如拉取转换文献表属性变更集，获取及自动化填充外部智能互联转化结果，与资料大列表交叉的组别重构行为指令触发动作区之中。
*   **`useFileDrop.ts`**: Specifically manages React boundary intercepts capturing OS-level `.ris` drag n drop events cleanly before deferring standard import calls.
    *   这完全是专门针对于 React 底层跨域和 OS 级别接口通信互拦截逻辑的处理截面，用极其纯利落的代码预先包裹截取下坠落在特定界面容器里的 `.ris` 类型标准文件集拖放（Drag&Drop）相关底层参数流，随后通过明确判定将其释放提交引流进标准的后台装载序列池内。
