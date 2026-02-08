module.exports = {
    createOldCatalogs: false,
    indentation: 4,
    lexers: {
        js: ['JsxLexer'],
        ts: ['JsxLexer'],
        jsx: ['JsxLexer'],
        tsx: ['JsxLexer'],
        default: ['JsxLexer']
    },
    locales: ['en-US', 'zh-CN'],
    output: 'src/locales/$LOCALE.json',
    input: ['src/**/*.{js,jsx,ts,tsx}'],
    verbose: true,
    // Keep existing translations
    keepRemoved: true,
    // Sort keys to keep json diffs clean
    sort: true,
    // Default namespace
    defaultNamespace: 'translation',
    // Key separator (default is .)
    keySeparator: '.',
    // Namespace separator (default is :)
    namespaceSeparator: ':',
};
