# PaperView

PaperView 是一个为科研人员设计的论文同步与管理工具。它通过浏览器脚本捕捉主流期刊网站上的论文数据，并实时同步到桌面应用进行统一展示、管理和元数据获取。

## 项目组成

项目主要由以下三个部分组成：

1.  **[app](file:///c:/Users/Steven/OneDrive%20-%20stevenshensg/diskD/0x00000000/Develop/PaperView/app)**: 基于 Tauri + React + Rust 开发的桌面应用程序。
2.  **[BrowserScript](file:///c:/Users/Steven/OneDrive%20-%20stevenshensg/diskD/0x00000000/Develop/PaperView/BrowserScript)**: Userscript 脚本（Tampermonkey 兼容），用于在浏览器侧捕捉论文信息。
3.  **[test](file:///c:/Users/Steven/OneDrive%20-%20stevenshensg/diskD/0x00000000/Develop/PaperView/test)**: 包含开发过程中的测试脚本，如清理数据库的 Python 工具。

## 核心特性

-   **实时同步**: 浏览器脚本通过 HTTP 接口将捕捉到的论文数据秒速推送到桌面端。
-   **元数据增强**: 支持通过 DOI 自动从 CrossRef 等源获取论文的详细元数据（如出版日期、卷期信息）。
-   **虚拟滚动**: 处理海量论文数据时依然保持极致流畅的滚动体验（由 `react-virtuoso` 驱动）。
-   **多语言支持**: 界面支持中英文无缝切换。
-   **主题系统**: 完整的亮色/暗色模式适配，支持跟随系统设置。
-   **AI 助手**: 集成了初步的 AI 边栏，为后续论文摘要总结与对话功能奠定基础。

## 快速开始

### 桌面端 (app)

请参考 [app/README.md](file:///c:/Users/Steven/OneDrive%20-%20stevenshensg/diskD/0x00000000/Develop/PaperView/app/README.md) 获取详细的构建与运行指南。

### 浏览器端 (BrowserScript)

1.  确保浏览器已安装 Tampermonkey 插件。
2.  将 `BrowserScript/paperview.user.js` 的内容复制并创建为新的用户脚本。
3.  当你在支持的期刊页面时，脚本将自动尝试与正在运行的 PaperView 桌面应用建立连接。
