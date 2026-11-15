# build resources

This folder holds Windows packaging assets. `build/icon.ico` (256×256 multi-size) is
required by electron-builder before the Phase 7 installer build. Until then,
`npm run build` produces the bundled output without an installer.
