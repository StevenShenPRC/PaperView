---
description: Build an alpha release of the application
---

1. Ensure all changes are committed.
2. 询问用户版本号更改，更改所有版本号后编译，包括app\src-tauri\Cargo.toml  app\src-tauri\tauri.conf.json app\package-lock.json
app\package.json 以及浏览器脚本中的 BrowserScript\paperview.user.js
3. Run the build command:
   ```powershell
   npm run tauri build
   ```
4. The installer will be located at:
   - `src-tauri/target/release/bundle/msi/PaperView_0.1.0_x64_en-US.msi` (or similar)
   - `src-tauri/target/release/bundle/nsis/PaperView_0.1.0_x64-setup.exe`

Note: Due to Windows MSI installer restrictions, the version string in `tauri.conf.json` **must** be strictly numeric (e.g., `0.0.1`). 
- If you use `0.0.1-alpha.1`, the MSI build will fail.
- Recommended approach: Use the semantic version (e.g., `0.0.1-alpha.1`) in `package.json` and `Cargo.toml`, but keep `tauri.conf.json` as `0.0.1`.
- The installer filename can be manually renamed after the build to add suffixes like `-alpha.1`.

5. rename windows installer with a suffix like -alpha.1 according to the version string in build config