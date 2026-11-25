import { base, today, money } from '../utils/ledger'
import type { Receipt } from '../types'
export async function digest(value: Blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await value.arrayBuffer())
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
}
function nominal(text: string) {
  const matches = text.match(/\d[\d.,]*/g) || []
  const token = matches.at(-1)?.replace(/[.,]\d{2}$/, '') || ''
  const n = Number(token.replace(/[^\d]/g, ''))
  return money(n) ? n : 0
}
export function parseReceipt(
  text: string,
  workspace: string,
  hash: string,
  confidence: number,
): Receipt {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  const amount = (pattern: RegExp) =>
    nominal(lines.filter((s) => pattern.test(s)).at(-1) || '')
  const date =
    text
      .match(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/)
      ?.slice(1)
      .join('-') ||
    text
      .match(/\b(\d{2})[-/.](\d{2})[-/.](\d{4})\b/)
      ?.slice(1)
      .reverse()
      .join('-') ||
    today()
  return {
    ...base(workspace),
    hash,
    text,
    confidence,
    merchant: lines[0]?.slice(0, 120) || '',
    address:
      lines.find((s) => /\b(?:jalan|jl\.|alamat|street)\b/i.test(s)) || '',
    number:
      text.match(
        /(?:invoice|receipt|struk|referensi|ref)\s*(?:no\.?|#|:)?\s*[:#]?\s*([\w-]{3,})/i,
      )?.[1] || '',
    date,
    time: text.match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/)?.[0] || '',
    amount: amount(
      /^(?:grand\s+total|total(?:\s+(?:bayar|pembayaran|transfer|harga))?|jumlah\s+(?:bayar|transfer)|nominal)\b(?!\s+(?:item|qty))/i,
    ),
    subtotal: amount(/^sub\s*total/i),
    discount: amount(/^(?:diskon|discount)/i),
    tax: amount(/^(?:ppn|pajak|tax)/i),
    fee: amount(/^(?:admin|biaya|service)/i),
    method:
      text.match(
        /\b(?:QRIS|debit|kredit|tunai|cash|transfer|GoPay|DANA|OVO|ShopeePay)\b/i,
      )?.[0] || '',
    items: lines
      .filter(
        (s) =>
          /\d[.,]\d{3}\b/.test(s) &&
          !/^(?:grand|sub|total|jumlah|pajak|ppn|diskon|biaya|admin|nominal|kembali|bayar)/i.test(
            s,
          ),
      )
      .join('\n'),
  }
}
export async function recognize(
  blob: Blob,
  workspace: string,
  hash: string,
  progress: (n: number) => void,
) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['ind', 'eng'], 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') progress(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(blob)
    return parseReceipt(data.text, workspace, hash, data.confidence)
  } finally {
    await worker.terminate()
  }
}
export async function editImage(
  blob: Blob,
  rotation: number,
  crop: number,
  enhance: boolean,
  autoCrop = false,
) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  const factor = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
  const edge = crop / 100
  let box = {
    x: bitmap.width * edge,
    y: bitmap.height * edge,
    width: bitmap.width * (1 - 2 * edge),
    height: bitmap.height * (1 - 2 * edge),
  }
  if (autoCrop && crop === 0) {
    const thumb = document.createElement('canvas')
    const scale = 160 / Math.max(bitmap.width, bitmap.height)
    thumb.width = Math.max(1, Math.round(bitmap.width * scale))
    thumb.height = Math.max(1, Math.round(bitmap.height * scale))
    const sample = thumb.getContext('2d', { willReadFrequently: true })!
    sample.drawImage(bitmap, 0, 0, thumb.width, thumb.height)
    const px = sample.getImageData(0, 0, thumb.width, thumb.height).data
    const light = (i: number) => (px[i] + px[i + 1] + px[i + 2]) / 3
    if (
      [
        0,
        (thumb.width - 1) * 4,
        (thumb.height - 1) * thumb.width * 4,
        (thumb.width * thumb.height - 1) * 4,
      ].every((i) => light(i) < 145)
    ) {
      let x1 = thumb.width,
        y1 = thumb.height,
        x2 = 0,
        y2 = 0,
        count = 0
      for (let y = 0; y < thumb.height; y++)
        for (let x = 0; x < thumb.width; x++) {
          if (light((y * thumb.width + x) * 4) < 200) continue
          x1 = Math.min(x1, x)
          x2 = Math.max(x2, x)
          y1 = Math.min(y1, y)
          y2 = Math.max(y2, y)
          count++
        }
      if (
        count > thumb.width * thumb.height * 0.13 &&
        x2 - x1 > thumb.width * 0.22 &&
        y2 - y1 > thumb.height * 0.22
      ) {
        const left = Math.max(0, x1 - 4),
          top = Math.max(0, y1 - 4),
          right = Math.min(thumb.width, x2 + 5),
          bottom = Math.min(thumb.height, y2 + 5)
        box = {
          x: left / scale,
          y: top / scale,
          width: Math.min(bitmap.width - left / scale, (right - left) / scale),
          height: Math.min(bitmap.height - top / scale, (bottom - top) / scale),
        }
      }
    }
  }
  const w = Math.max(1, Math.round(box.width * factor)),
    h = Math.max(1, Math.round(box.height * factor))
  canvas.width = rotation % 180 ? h : w
  canvas.height = rotation % 180 ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  if (enhance) ctx.filter = 'grayscale(1) contrast(1.45)'
  ctx.drawImage(
    bitmap,
    box.x,
    box.y,
    box.width,
    box.height,
    -w / 2,
    -h / 2,
    w,
    h,
  )
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('Gambar tidak dapat disiapkan.'))),
      'image/jpeg',
      0.84,
    ),
  )
}
export async function dataURL(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
