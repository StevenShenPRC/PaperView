# PaperView 开发交接文档 (HANDOVER.md)

## 当前状态 (2026-02-14)

### 1. 自绘弹窗与架构精化 (Phase 4.4 - Current)
- **全局自绘弹窗系统**:
  - **组件**: `DialogContext.tsx` 替代了所有原生 `alert` 和 `confirm` 调用，支持 Promise 化调用。
  - **架构**: 引入了 `ThemeContext.tsx` 统一管理主题，并调整了 `main.tsx` 中的 Provider 顺序（`AppThemeProvider` -> `DialogProvider` -> `App`），确保弹窗能正确应用主题。
  - **视觉**: 在深色模式下实现了高级视觉效果，包括毛玻璃背景 (`blur(16px)`)、渐变边框和优化后的投影。
- **RIS 存储与导入优化**:
  - **精准存储**: `import_ris` 现在仅存储每条论文自身的 RIS 片段，极大降低了数据库空间占用。
  - **多条支持**: 手动导入 RIS 文件现在支持批量循环插入。
- **后端修复**:
  - **编译问题**: 修复了 `main.rs` 中 `Ok(results)` 类型推断导致的 E0282 错误。
  - **查询适配**: 修正了 `get_papers` 逻辑，支持“手动导入”批次的新旧数据聚合显示。
- **UI 细节与功能修复**:
  - **OpenAlex**: 集成了摘要解压还原逻辑 (`abstract_inverted_index`)。
  - **动画与显示**: 手风琴动画固定为 0.5s，列表日期修正为显示 `issueDate`。
  - **清理**: 移除了废弃的 `ConfirmDialog.tsx` 及各组件中的冗余导入。

### 2. 之前已完成功能 (回顾)
- **RIS 标准化**: 支持 BibTeX/RIS 导出，对接 OpenAlex 获取元数据。
- **浏览器脚本**: 支持 ScienceDirect (API 模式) 和 Web of Science。
- **全局拖放**: 支持全局 RIS 拖入导入，以及拖入 AI 聊天添加上下文。

---

## 待办事项 / 后续建议
1. **Zotero 集成**: 建议下一步支持直接从 Zotero 库库文件同步。
2. **下载拦截**: 进一步强化 Web of Science 等平台的自动元数据抓取。

## 开发注意事项
- **MUI 弹窗样式**: `Dialog` 组件样式定制应使用 `slotProps.paper` 以避免弃用警告。
- **主题层次**: `DialogProvider` 必须嵌套在 `ThemeProvider` (或 `AppThemeProvider`) 内部。
- **版本号**: Windows 构建要求版本号为纯数字格式（如 `0.1.1`）。
- **RIS 正则**: `ris.rs` 中的正则需兼顾不同厂商换行符和空格的差异。
