/**
 * Generates soloLeving app icons from a simple drawn design:
 * a rounded square in the brand green with a white checkmark.
 *
 * Outputs:
 *   build/icon.ico  (16/32/48/64/128/256, PNG-compressed entries)
 *   build/icon.png  (256, for extraResources / docs)
 *
 * No dependencies: PNG is encoded with node:zlib, ICO wraps PNG entries.
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const GREEN = [50, 183, 122, 255] // #32B77A — brand primary
const WHITE = [255, 255, 255, 255]
const CLEAR = [0, 0, 0, 0]

/** Draw the icon into an RGBA buffer of the given square size. */
function draw(size) {
  const data = Buffer.alloc(size * size * 4)
  const radius = size * 0.24
  const stroke = size * 0.115
  // Checkmark polyline (unit space): down-slope, up-slope to the top right.
  const points = [
    [0.27 * size, 0.52 * size],
    [0.44 * size, 0.69 * size],
    [0.76 * size, 0.31 * size]
  ]
  const half = stroke / 2

  const put = (x, y, [r, g, b, a]) => {
    const i = (y * size + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  const lerp = (a, b, t) => a + (b - a) * t
  const blend = (bg, fg, alpha) => [
    Math.round(lerp(bg[0], fg[0], alpha)),
    Math.round(lerp(bg[1], fg[1], alpha)),
    Math.round(lerp(bg[2], fg[2], alpha)),
    Math.round(lerp(bg[3], fg[3], alpha))
  ]
  const distToSegment = (px, py, [ax, ay], [bx, by]) => {
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx
    const cy = ay + t * dy
    return Math.hypot(px - cx, py - cy)
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Supersample 3x3 for anti-aliasing.
      let bgCount = 0
      let markCount = 0
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const px = x + (sx + 0.5) / 3
          const py = y + (sy + 0.5) / 3
          // Rounded-square mask.
          const cx = Math.min(Math.max(px, radius), size - radius)
          const cy = Math.min(Math.max(py, radius), size - radius)
          const inRect = Math.hypot(px - cx, py - cy) <= radius
          if (!inRect) continue
          bgCount++
          // Checkmark stroke.
          let best = Infinity
          for (let s = 0; s < points.length - 1; s++) {
            best = Math.min(best, distToSegment(px, py, points[s], points[s + 1]))
          }
          if (best <= half) markCount++
        }
      }
      const total = 9
      if (bgCount === 0) {
        put(x, y, CLEAR)
        continue
      }
      const bgAlpha = bgCount / total
      const markAlpha = markCount / total
      const base = blend(CLEAR, GREEN, bgAlpha)
      put(x, y, markAlpha > 0 ? blend(base, WHITE, markAlpha) : base)
    }
  }
  return data
}

// ---- Minimal PNG encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, body) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(body.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])))
  return Buffer.concat([len, typeBuf, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- ICO writer (PNG-compressed entries) ----
function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  const directory = []
  const payloads = []
  let offset = 6 + images.length * 16
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry[0] = size === 256 ? 0 : size // 0 means 256
    entry[1] = size === 256 ? 0 : size
    entry[2] = 1 // color count (ignored for PNG)
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bpp
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    directory.push(entry)
    payloads.push(png)
    offset += png.length
  }
  return Buffer.concat([header, ...directory, ...payloads])
}

const SIZES = [16, 32, 48, 64, 128, 256]
mkdirSync(join(root, 'build'), { recursive: true })

const images = SIZES.map((size) => ({ size, png: encodePng(size, draw(size)) }))
writeFileSync(join(root, 'build', 'icon.ico'), encodeIco(images))
writeFileSync(
  join(root, 'build', 'icon.png'),
  images.find((image) => image.size === 256).png
)

console.log('Wrote build/icon.ico (16..256) and build/icon.png (256x256)')
