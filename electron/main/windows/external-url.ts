/**
 * Validation for URLs the renderer asks the OS to open.
 *
 * AGENTS.md rule: never pass renderer-supplied URLs to `shell.openExternal`
 * without validation. Only plain http(s) URLs are safe to hand to the OS.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return SAFE_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}
