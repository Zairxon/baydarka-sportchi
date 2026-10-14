// Иконки приложения спортсмена: та же эмблема, что у APK Байдарки (assets/icon-source.png,
// чёрное на белом), но в изумрудном двухцветном варианте, чтобы значки отличались.
// Запуск: node scripts/gen-icons.mjs  (нужен пакет sharp, например из ../baydarka/node_modules)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(process.env.SHARP_FROM || import.meta.url)
const sharp = require('sharp')
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const DARK = [14, 110, 92]      // тёмный изумруд
const LIGHT = [232, 246, 240]   // светлая мята

// Яркость → цвет между DARK и LIGHT. Бледный водяной знак исходника уходит в фон.
async function duotone(file, size) {
  const { data, info } = await sharp(file).resize(size, size, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 3)
  for (let i = 0; i < info.width * info.height; i++) {
    const lum = (data[i * 3] * 0.3 + data[i * 3 + 1] * 0.59 + data[i * 3 + 2] * 0.11) / 255
    const t = Math.min(1, Math.max(0, (lum - 0.25) / 0.6))   // контраст: светлее 85 % — фон
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(DARK[c] + (LIGHT[c] - DARK[c]) * t)
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
}

const src = join(root, 'assets', 'icon-source.png')
const pub = join(root, 'public')
const bg = { r: LIGHT[0], g: LIGHT[1], b: LIGHT[2], alpha: 1 }

// Обычная иконка: эмблема с небольшим полем.
async function plain(size, name, pad = 0.06) {
  const inner = Math.round(size * (1 - pad * 2))
  const art = await (await duotone(src, inner)).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: art, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }]).png().toFile(join(pub, name))
  console.log('✓', name)
}

await plain(32, 'favicon-32x32.png', 0.02)
await plain(180, 'apple-touch-icon.png')
await plain(192, 'pwa-192x192.png')
await plain(512, 'pwa-512x512.png')
await plain(512, 'maskable-icon-512x512.png', 0.17)   // «безопасная зона» маски Android — эмблема в центре 66 %
