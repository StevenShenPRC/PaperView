# PaperView 开发交接文档 (HANDOVER.md)

## 当前状态 / 最新改动 (2026-03-01 - 00:20)

### 1. 版本递进与 Alpha 构建 (Phase 5.0 - 最新)
- **版本递进**: 统一升级全线版本号至 `0.2.1`（涉及 `package.json`, `Cargo.toml`, `tauri.conf.json`, `paperview.user.js`）。
- **Alpha 1 发布**: 成功构建带有 `-alpha.1` 后缀的 MSI 与 NSIS 安装包，解决了 Windows 平台的版本号格式约束。
- **自动化构建**: 规范化了 `/build-alpha` 工作流，确保锁文件 (`package-lock.json`) 强制同步。

### 2. i18n 全量提取与 9 语种对齐 (Phase 4.9)
- **多语言对齐**: 补全了中、英、日、韩、德、法、西、意、俄共 9 种语言的所有缺失翻译。
- **键位覆盖**: 重点针对“全局路由”、“上下文窗口”、“模型详情”、“自定义元数据”等新功能进行了 100% 翻译覆盖，消除了界面裸码。
- **工作流集成**: 验证了 `npm run i18n:extract` 的稳定性，确保翻译键位随代码同步演进。

### 3. [已完成] <s>AI 设置重构与组件解耦 (Phase 4.8)</s>
- **模型详情与元数据管理**:
  - **模糊搜索**: 模型元数据搜索现支持空格分隔（逻辑“+”）的模糊匹配模式。
  - **详情页集成**: 整合了模型编辑与详情展示，支持展示源 JSON 片段及解析后的主要内容。
  - **功能标识**: 将单模态提示拆分为精细化的视觉、听觉等图标，提升 UI 表现力。
- **供应商-模型解耦**:
  - 修改了 AI 设置中的默认模型选择器。拥有明确类型（`chat`, `embedding` 等）的模型优先置顶，`unknown` 类型模型排在底部，并增加了“未分类”分隔线标识。
  - 在选择器中同时显示模型提供商名称（如 `OpenAI — gpt-4o`）。
- **供应商-模型全局解耦**:
  - **RightSidebar 适配**: 重构了 `useChat.ts` 和 `ChatHeader.tsx`。聊天侧边栏现在可以从**所有已配置的供应商**中收集 chat 类型的模型。
  - **跨供应商切换**: 用户在聊天界面选择不同供应商的模型时，系统会自动同步更新全局 `active_ai_provider`。
  - **复合值处理**: 聊天模型选择器内部使用 `provider::model_id` 复合格式确保唯一性。
- **上下文长度显示优化**:
  - 在供应商列表和详情中，上下文长度采用缩写显示（如 `1M`, `128K`），保留三位有效数字。
  - 提供详情视图，格式如 `1.00M (1,000,000)`。
- **持久化修复**:
  - 修复了 `SettingsDialog.tsx` 在保存设置时未包含 `default_chat_model` 等 `ModelRouting` 对象的 bug。
  - `useChat` 现已增加对 `default_chat_model` 键位的监听，确保设置更改后聊天界面立即生效。
- **UI 微调**:
  - **供应商列表**: 折叠/展开箭头移至标题最左侧（Accordion row-reverse）。
  - **模型列表按钮**: 文字更新为 `模型列表：{count}`，风格统一。
- **文档化补全**:
  - 为 `PDFReader`, `RightSidebar`, `Sidebar` 子目录补全了详细的架构说明 `.md` 文件。
  - 更新了顶级 `components.md`、`settings.md` 和 `PaperList.md` 以匹配最新架构。

---

### 4. [已完成] <s>全局配置解耦与后端重构 (Phase 4.7)</s>
- **底层解耦**: `main.rs` 和 `config.rs` 被完全重构，原先的统一设定读取已被拆解为分立接口 `get_chat_config`, `get_translate_config`, `get_embedding_config`。
- **全局模型路由 (Global Routing)**: 引入了 `ModelRouting` 结构。不再于供应商层级固化 Default Model。前端通过 `ModelRoutingSelect` 令用户对 Chat、翻译和嵌入等任务灵活绑定不同平台的模型。
- **元数据智能匹配**: 集成了本地 `model_prices_and_context_window.json`。支持向前端返回上下文长度、大模型功能（视觉、推理等），丰富了模型列表的属性展示。

---

### 5. [已完成] <s>批量翻译、多语言对齐与自绘系统 (Phase 4.4 - 4.6)</s>
- **排队批量翻译**: 
  - `handleBatchTranslate` 会根据 `batch_translate_size` 切割任务。
  - 队列式请求确保了稳定性，支持中途失败后的“继续/重试”确认逻辑。
- **i18n 全量对齐**: 以 `zh-CN` 为基准，完成了所有语言（de, es, fr, it, ja, ko, ru）的键位对齐与全量翻译更新，确保占位符一致。
- **全局自绘弹窗系统**:
  - `DialogContext.tsx` 替代原生 `alert`/`confirm`。
  - 支持毛玻璃背景 (`blur(16px)`)、渐变边框等高级 CSS 视觉效果。
  - Provider 顺序优化：`AppThemeProvider` -> `DialogProvider` -> `App`。
- **RIS 存储优化**: 
  - `import_ris` 现在仅存储单条论文自身的片段。
  - 支持手动导入 RIS 文件的批量循环插入。

---

## 历史回顾 / 累计功能 (Historical Milestones)

### A. PDF 阅读器与三栏布局 (Phase 2)
- **布局**: 左(PaperList) + 中(PDFReader) + 右(AI Sidebar) 三栏。
- **阅读器交互**:
  - 基于 `react-pdf` 封装，支持 Ctrl+滚轮/捏合缩放（10% 步长锁定）。
  - 实现“收起”模式：收起时卸载组件释放资源，保留引用以便一键重开。
  - 页码/缩放输入框支持一键全选。
  - **视觉 HACK**: 修复了 Text Layer 选区不对齐问题（透明文字 + 混合模式模拟高亮）。
- **侧边栏常驻**: 右侧 AI 栏始终可见，无 PDF 时移除 New Chat，有 PDF 时显示“打开阅读器”。

### B. 搜索架构与向量优化 (Phase 2.5)
- **向量搜索**: 引入 `distance_threshold` (0.8) 和**相对差值过滤**策略。
- ~~**FTS5 尝试**~~: 已尝试在 SQLite 中集成 FTS5，但由于中文分词支持差且集成复杂，目前已**搁置**。
- **未来方向**: 确定迁移至 **SQLite + Milli** 的混合架构。

### C. 元数据抓取与风控 (Phase 1.x)
- **回退机制**: DOI -> CrossRef -> Semantic Scholar -> Springer Crawler。
- **爬虫能力**: 针对 Springer 实现了页层抓取及 Header 伪装。
- **速率限制**: 后端 1s/10m/100h 三级限流；前端区分普通错误与风控错误，通过 Dialog 提示。

### D. 身份标识与基础架构
- **动态图标**: 窗口图标根据系统亮/暗主题实时切换 (`window_icon.rs`)。
- **脚本分发**: 后端嵌入并提供 `GET /paperview.user.js` 服务，侧边栏一键跳转安装。
- **虚拟列表**: `react-virtuoso` 支撑海量数据滚动。
- **自动 DOI**: 从 CrossRef 获取缺失的卷、期、出版日期。

---

## 发布记录 (Release History)
- **0.2.1-alpha.1**: 完成 i18n 九语种全量对齐，发布首个包含完善模型详情页的 Alpha 版本。
- **0.2.0**: 全面升级 UI 自绘系统，实现 AI 模型解耦路由，修复多项持久化 Bug。
- **0.1.0-alpha.0**: 首个 Alpha 编译版。解决 MSI 版本号格式（必须纯数字）限制。
- **0.0.1-alpha.1**: 统一全线版本号。
- **0.0.2-alpha.0**: 完成 Phase 2 阅读器核心重构。

---

## 关键文件/模块说明 (Key Modules)

### 后端 (Rust)
- `src-tauri/src/ai.rs`: **(新增/解耦)** 核心 AI 逻辑，处理请求拼接与提供商转发。
- `src-tauri/src/config.rs`: 配置解析中枢，支持 `ModelRouting`。
- `src-tauri/src/server.rs`: 处理浏览器脚本推送的 HTTP 服务及脚本分发。
- `src-tauri/src/db.rs`: SQLite 操作，元数据合并逻辑。
- `src-tauri/src/window_icon.rs`: 窗口图标动态切换逻辑。

### 前端 (React)
- `src/components/PDFReader/`: 包含缩放、导航、上下文菜单等详细逻辑。
- `src/components/RightSidebar/`: 聊天生命周期管理、模型分组选择、复制逻辑。
- `src/components/settings/ProviderManager.tsx`: 极为复杂的 AI 供应商配置面板。
- `src/utils/modelUtils.ts`: 模型元数据模糊匹配、上下文窗口转换工具。
- `src/context/DialogContext.tsx`: 全局 Promise 化 UI 交互指令集。

---

## 踩坑与开发规范 (Gotchas & Standards)

1.  **PDF 选区对齐**: 严禁全局修改 `span` 的 `display`/`height`。必须使用 `App.css` 中的透明文字 HACK。且 `App.css` 必须在 `main.tsx` 引用才有效。
2.  **版本号约束**: Windows MSI 构建要求版本号符合 `x.y.z`（纯数字），不支持 `-alpha` 等标签。
3.  **Tauri 资源释放**: 阅读器“收起”必须物理卸载 (`unmount`) 以释放内存。
4.  **MUI Dialog**: 样式定制应通过 `slotProps.paper` 进行，避免弃用警告。
5.  **主题顺序**: `DialogProvider` 必须在 `AppThemeProvider` 内部，否则自绘弹窗无主题。
6.  **Git 提交要求**: 维持中英双语文档同步。修改子目录结构时需同步更新对应的 `.md` 文档。
7.  **只增不删原则**: 在更新此类文档或 `components.md` 等架构文档时，过时内容应使用删除线标识或注释掉，不得直接删除，以保留演进历史。

---

## 待办事项 / 后续建议 (Next Steps)
- [x] **README 多语言更新**: 更新了 `README.md`，包含多平台安装指南、自动更新特性及英文版本。
- [x] **发布流程指南**: 创建了 `github_secrets_guide.md` 并更新了 release workflow。
1. **Milli 集成**: 彻底解决中文全文索引和混合检索。
2. **Zotero 同步**: 实现与 Zotero 本地数据库的实时或双向同步。
3. **模型自定义元数据**: 在手动匹配失败时，增强“自定义预设”加载功能。
4. **对话导出**: 支持将 AI 对话记录导出为 Markdown 或 PDF。
