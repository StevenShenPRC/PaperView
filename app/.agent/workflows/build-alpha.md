---
description: Build an alpha release of the application
---

1. Ensure all changes are committed.
2. Run the build command:
   ```powershell
   npm run tauri build
   ```
3. The installer will be located at:
   - `src-tauri/target/release/bundle/msi/PaperView_0.1.0_x64_en-US.msi` (or similar)
   - `src-tauri/target/release/bundle/nsis/PaperView_0.1.0_x64-setup.exe`

Note: The version in the filename might still be `0.1.0` due to Windows installer restrictions on semver. You can manually rename the file to add `-alpha` if needed.
