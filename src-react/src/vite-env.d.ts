// Build-time flag: only a `VITE_MOCK=1` build includes the mock client (see
// runtime.ts). Unset in default/debug/release builds so the mock is tree-shaken.
interface ImportMetaEnv {
  readonly VITE_MOCK?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
