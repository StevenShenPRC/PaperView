---
description: Automatically extract i18n keys from source code for all supported languages
---

1. Run the extraction script
// turbo
npm run i18n:extract

2. Review the changes in `src/locales/*.json` (e.g., zh-CN, en-US, ja-JP, etc.)
3. Fill in the missing translations in all relevant language files (keys with empty strings or identical to key)
