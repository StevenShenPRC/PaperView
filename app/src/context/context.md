# `context` Directory Architecture / `context` 上下文状态架构

## Overview / 概述

Instead of aggressively passing props down multiple layers of React component trees ("prop-drilling"), the `context` directory implements React Context providers to make global UI states (like active dialogs or themes) available universally to any deeply nested components.

不同于沿着 React 组件树向下一层层强行传递 Props （所谓"属性钻取"），本目录建立在原生 React Context 提供者（Providers）层之上，使得全局化的界面系统状态变量集群（例如活动状态触发出的全局模态阻断面板通知或界面主题色）能够无死角地注入至任何存在深层嵌套层级逻辑关系的节点组件群里去。

## Provided Contexts / 提供的上下文

*   **`DialogContext.tsx`**
    *   Provides global wrappers for generic `alert` and `confirm` dialogs. Any component can call `useDialog().alert("Error")` to trigger a Material UI modal instantly without managing standalone modal open states inside their own components.
    *   为通用目的所需的系统级别提示（`alert`）与强效阻断式二次确认警告面板（`confirm`）打造标准化及一体化的外部包裹层。这样使得整个程序栈中的任一组件即可快速且标准地执行调用如 `useDialog().alert("Error MSG")` 这类预制好的 Material UI 组件库实例化代码段从而引出模态框展示。免去了开发者必须还要在每个单独组件里再独自绑定或重新搭建本地化模式状态布尔变量来处理这些高复用性场景的低端冗余工作。

*   **`ThemeContext.tsx`**
    *   Governs standard theme colors dynamically responding to light mode, dark mode, or system default parameters. Directly wires into Material UI's `ThemeProvider`.
    *   管理与控制标准化设计定义下的界面色彩主题变化行为动态监听集——主要承载亮色和暗色或是依托本地底层系统基准偏好设置间的自然过渡调度业务。此类输出参数信息将直奔应用上层建筑中最关键节点处的 Material UI 主题控制器节点 `ThemeProvider`。
