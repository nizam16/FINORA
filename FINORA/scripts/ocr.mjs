import { mkdir, copyFile, readdir } from 'node:fs/promises'
await mkdir('public/ocr', { recursive: true })
await copyFile(
  'node_modules/tesseract.js/dist/worker.min.js',
  'public/ocr/worker.min.js',
)
for (const name of await readdir('node_modules/tesseract.js-core')) {
  if (/lstm.*\.wasm\.js$/.test(name))
    await copyFile(
      'node_modules/tesseract.js-core/' + name,
      'public/ocr/' + name,
    )
}
for (const lang of ['ind', 'eng'])
  await copyFile(
    `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    `public/ocr/${lang}.traineddata.gz`,
  )
