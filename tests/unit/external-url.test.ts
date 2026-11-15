import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from '../../electron/main/windows/external-url'

describe('isSafeExternalUrl', () => {
  it('accepts plain https and http URLs', () => {
    expect(isSafeExternalUrl('https://example.com/page')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
  })

  it('rejects non-http(s) schemes that could execute or open odd handlers', () => {
    expect(isSafeExternalUrl('file://C:/Windows/system32')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('data:text/html,hello')).toBe(false)
    expect(isSafeExternalUrl('vbscript:msgbox')).toBe(false)
    expect(isSafeExternalUrl('ms-settings:display')).toBe(false)
    expect(isSafeExternalUrl('shell:downloads')).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(isSafeExternalUrl('')).toBe(false)
    expect(isSafeExternalUrl('not a url')).toBe(false)
    expect(isSafeExternalUrl('https://')).toBe(false)
  })
})
