# `PaperList` Component Architecture / `PaperList` 组件架构说明

## Overview / 概述

The `PaperList/` component defines the middle column table view for managing reference metadata. It natively handles virtualization to manage hundreds of records efficiently, implements rich expandable "metadata cells", controls sorting mechanisms, provides drag actions into categories, and delegates operations (translate, fetch metadata, read pdf).

`PaperList/` 组件定义了用于管理参考资料元数据的中间栏表格视图。它通过原生虚拟化（Virtualization）来高效管理数百条记录，实现了内容丰富的可展开“元数据单元格”，控制排序机制，提供拖拽到分类的操作体验，并委派动作（例如翻译、抓取元数据、阅读 PDF 附件等）。

> [!TIP]
> This component was specifically designed to handle long lists smoothly. Any modifications directly inside rendering loops or lists require careful performance profiling to avoid unnecessary re-renders.
> 
> 该组件专为流畅处理长列表而设计。如果直接在渲染循环或列表中进行任何修改，都需要进行仔细的性能验证，以避免出现不必要的重新渲染导致卡顿。

## Components / 模块拆分

*   **`PaperList/index.tsx` (Main Container / 主容器)**
    *   Binds generic data inputs (papers) into grouped outputs. Sets up the main List infrastructure via standard Material UI elements alongside complex styling bounds.
    *   将通用数据输入（论文数组）绑定到分组输出中。利用标准的 Material UI 元素结合复杂的样式界限构建底层列表的基础架构。
    *   Defines context menu overlays.
    *   定义上下文菜单覆盖层。
    
*   **`components/PaperItem.tsx` (Row Renderer / 行渲染器)**
    *   Responsible for rendering single-row iterations efficiently. Uses `memo` and strict props checking to stop entire table reloads.
    *   负责高效地单行迭代渲染。内部利用 `memo` 和严格的 props（参数）比对验证机制，防止在小动作触发时引起整个表格的高代价重新渲染。
    *   Integrates the "Drag Source" allowing users to grab the row and append to the local AI or sidebar groups.
    *   集成“拖曳源（Drag Source）”使得用户能够抓取行本身，并将它挂载转移到底部的本地 AI 聊天界面或侧边栏自定义分组中。

*   **`components/ExportDialog.tsx`**
    *   Triggered from batch selecting entries, offering raw `BibTeX` or `.ris` standard exports formatting blocks. Provides one-click clipboard saving or `.txt`/`.ris` file output configurations.
    *   在批量选中列表条目时触发调用，提供对原始 `BibTeX` 或 `.ris` 常见标准格式导出块的浏览和整理。具备一键式的剪贴板转移或是 `.txt`/`.ris` 的本地文件导出生成配置选项。

## Hooks / 业务逻辑钩子

The component uses various custom hooks located strictly scoped to `PaperList/hooks/`.
组件使用了紧密作用于 `PaperList/hooks/` 本地的各种定制业务钩子。

*   **`useSorting.ts`**: Pure mathematical and comparator evaluations keeping `Paper[]` consistently organized by predefined table headers (`date_added`, `year`, `title`, `author`). Ensures stable transitions. / 纯数学层面的鉴权对比运算设计，使得 `Paper[]` 数据按照表头字段结构进行固定规划展示（诸如：添加日期，年份，标题，作者等）。保障交互和稳定排列过渡。
*   **`useSelection.ts`**: Monitors standard multi-row clicking parameters (with optional `Shift` key drag parameters or basic `Ctrl` stacking). / 监控标准多重分块选角参数控制事件集（可选的键盘 `Shift` 拖放级联叠加机制，或常规的 `Ctrl` 随点多选并层机理）。
*   **`useDragDrop.ts`**: Resolves generic HTML5 API Drop/Drag boundary interfaces for `PaperItem.tsx` sending outputs seamlessly into Tauri backends. / 为 `PaperItem.tsx` 提供标准通用 HTML5 API 拖放区域映射界面解构支持能力，同时顺滑传输到 Tauri 后端进行落地处理。
