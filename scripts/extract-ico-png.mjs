import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] ?? join(root, 'Logo(256x256).ico')
const output = join(root, 'resources', 'logo.png')

const buffer = readFileSync(source)
const count = buffer.readUInt16LE(4)
let best = null
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16
  const w = buffer[o] || 256
  const h = buffer[o + 1] || 256
  const size = buffer.readUInt32LE(o + 8)
  const off = buffer.readUInt32LE(o + 12)
  if (buffer.slice(off, off + 4).toString('hex') !== '89504e47') continue
  if (!best || size > best.size) best = { w, h, size, off }
}
if (!best) throw new Error('No embedded PNG found in ICO file')

const png = buffer.subarray(best.off, best.off + best.size)
const image = sharp(png)
  .resize(1024, 1024, { fit: 'cover', position: 'centre' })
  .png()
  .toFile(output)

await image
console.log(
  `Extracted ${best.w}x${best.h} PNG and upscaled to 1024x1024 -> ${output}`
)
