import { expect, test } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mulai dengan demo' }).click()
  await expect(page.getByRole('heading', { name: 'Halo, Demo' })).toBeVisible()
})
test('transfer, fee, editing, deletion and workspace isolation', async ({
  page,
}) => {
  const total = page.locator('.balance-number')
  await expect(total).toHaveText(/12\.500\.000/)
  await page.getByRole('button', { name: 'Transfer Dana' }).click()
  await page.getByLabel('Nominal (Rp)').fill('500000')
  await page.getByLabel('Dompet asal').selectOption('demo-bca')
  await page.getByLabel('Dompet tujuan').selectOption('demo-cash')
  await page.getByLabel('Biaya admin (Rp)').fill('2500')
  await page.getByLabel('Merchant').fill('Transfer uji')
  await page.getByRole('button', { name: 'Simpan transaksi' }).click()
  await expect(total).toHaveText(/12\.497\.500/)
  await page.getByRole('button', { name: /Transfer uji/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Biaya admin (Rp)').fill('5000')
  await page.getByRole('button', { name: 'Simpan transaksi' }).click()
  await expect(total).toHaveText(/12\.495\.000/)
  await page.getByRole('button', { name: /Transfer uji/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Hapus', exact: true }).click()
  await expect(total).toHaveText(/12\.500\.000/)
  await page.getByLabel('Workspace').selectOption('Business')
  await expect(total).toHaveText(/Rp\s*0/)
})
test('mobile receipt OCR, privacy and layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.getByRole('button', { name: 'Sembunyikan nominal' }).click()
  await expect(page.locator('.balance-number')).toHaveText(/••/)
  await page.getByRole('button', { name: 'Tampilkan nominal' }).click()
  await page.getByRole('button', { name: 'Scan Struk', exact: true }).click()
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 720
    c.height = 460
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#000'
    ctx.font = '36px monospace'
    const now = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Jakarta',
    }).format(new Date())
    const lines = [
      'TOKO FINORA',
      'Struk: AB123456',
      now + ' 12:30',
      'Subtotal Rp 50.000',
      'Pajak Rp 5.000',
      'Total Rp 55.000',
      'Tunai',
    ]
    lines.forEach((s, i) => ctx.fillText(s, 22, 49 + 51 * i))
    return c.toDataURL('image/png').split(',')[1]
  })
  await page
    .getByLabel('Foto dari galeri')
    .setInputFiles({
      name: 'struk.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    })
  await page.getByRole('button', { name: 'Baca struk' }).click()
  await expect(page.getByLabel('Total (Rp)', { exact: true })).toHaveValue(
    '55000',
    { timeout: 45_000 },
  )
  await page
    .getByRole('button', { name: 'Pilih dompet dan konfirmasi' })
    .click()
  await page.getByLabel('Dompet asal').selectOption('demo-cash')
  await page.getByRole('button', { name: 'Konfirmasi dan simpan' }).click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Struk dan transaksi tersimpan.' }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  )
  expect(errors).toEqual([])
})
test('persistence, offline shell and backup', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.balance-number')).toHaveText(/12\.500\.000/)
  await page.getByRole('button', { name: 'Tambah Transaksi' }).click()
  await page.getByLabel('Jenis', { exact: true }).selectOption('income')
  await page.getByLabel('Nominal (Rp)').fill('135000')
  await page.getByLabel('Dompet tujuan').selectOption('demo-cash')
  await page.getByLabel('Merchant').fill('Uji offline')
  await page.getByRole('button', { name: 'Simpan transaksi' }).click()
  await expect(page.locator('.balance-number')).toHaveText(/12\.635\.000/)
  await page.reload()
  await expect(page.locator('.balance-number')).toHaveText(/12\.635\.000/)
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Akun', exact: true }).click()
  await page.getByRole('button', { name: 'Backup, pemulihan & ekspor' }).click()
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh backup JSON' }).click()
  expect((await dl).suggestedFilename()).toBe('FINORA-backup.json')
})
test('PIN lock, bad PIN, unlock and logout', async ({ page }) => {
  await page.getByRole('button', { name: 'Akun', exact: true }).click()
  await page.getByRole('button', { name: 'Keamanan, PIN & Passkey' }).click()
  await page.getByLabel('PIN baru (6 digit)').fill('123456')
  await page.getByLabel('Konfirmasi PIN').fill('123456')
  await page.getByRole('button', { name: 'Simpan PIN' }).click()
  await page.getByRole('button', { name: 'Kunci sekarang' }).click()
  await expect(
    page.getByRole('heading', { name: 'FINORA terkunci' }),
  ).toBeVisible()
  await page.getByLabel('PIN 6 digit').fill('111111')
  await page.getByRole('button', { name: 'Buka FINORA' }).click()
  await expect(page.getByRole('alert')).toHaveText('PIN keliru.')
  await page.getByLabel('PIN 6 digit').fill('123456')
  await page.getByRole('button', { name: 'Buka FINORA' }).click()
  await page.getByRole('button', { name: 'Keluar', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Keluar', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Mulai dengan demo' }),
  ).toBeVisible()
})
test('goal, budget, debt, reconciliation and report exports', async ({
  page,
}) => {
  const navigate = async (tab: string) =>
    page
      .getByRole('navigation')
      .getByRole('button', { name: tab, exact: true })
      .click()
  await navigate('Akun')
  await page.getByRole('button', { name: /Anggaran, tabungan/ }).click()
  await page.getByRole('button', { name: /Dana Darurat/ }).click()
  await page.getByRole('button', { name: 'Ubah alokasi' }).click()
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('500000')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Dana Darurat/ }),
  ).toContainText(/4\.000\.000/)
  await page.getByRole('button', { name: 'Tambah Utang', exact: true }).click()
  await page.getByLabel('Nama pihak / kewajiban').fill('Kewajiban uji')
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('200000')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await page.getByRole('button', { name: /Kewajiban uji/ }).click()
  await page.getByRole('button', { name: 'Catat cicilan / pokok' }).click()
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('50000')
  await page.getByLabel('Dompet (opsional)').selectOption('demo-cash')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Kewajiban uji/ }),
  ).toContainText(/150\.000/)
  await navigate('Dompet')
  await page.getByRole('button', { name: /Cash.*Tunai/ }).click()
  await page.getByRole('button', { name: 'Rekonsiliasi' }).click()
  await page.getByLabel('Saldo aktual (Rp)').fill('2500000')
  await page.getByLabel('Alasan penyesuaian').fill('Hitung kas fisik')
  await page.getByRole('button', { name: 'Catat penyesuaian' }).click()
  await navigate('Beranda')
  await expect(page.locator('.balance-number')).toContainText('12.500.000')
  await expect(page.getByText(/680\.000/).first()).toBeVisible()
  await navigate('Statistik')
  for (const fmt of ['CSV', 'XLSX', 'PDF']) {
    const promise = page.waitForEvent('download')
    await page.getByRole('button', { name: fmt, exact: true }).click()
    const file = await promise
    expect(file.suggestedFilename()).toMatch(
      new RegExp('\.' + fmt.toLowerCase() + '$'),
    )
    expect(await file.failure()).toBeNull()
  }
})
test('batch receipt queue asks for explicit duplicate confirmation', async ({
  page,
}) => {
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 180
    c.height = 90
    const context = c.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, 180, 90)
    context.fillStyle = 'black'
    context.fillText('Receipt FINORA', 20, 25)
    return c.toDataURL('image/png').split(',')[1]
  })
  const buffer = Buffer.from(image, 'base64')
  await page.getByRole('button', { name: 'Scan Struk', exact: true }).click()
  await page
    .getByLabel('Foto dari galeri')
    .setInputFiles(
      ['a.png', 'b.png'].map((name) => ({
        name,
        mimeType: 'image/png',
        buffer,
      })),
    )
  await expect(page.getByText(/2 foto dalam antrean/)).toBeVisible()
  await page.getByRole('button', { name: 'Isi manual' }).click()
  await page.getByLabel('Toko / merchant').fill('Struk uji batch')
  await page.getByLabel('Total (Rp)', { exact: true }).fill('9000')
  await page
    .getByRole('button', { name: 'Pilih dompet dan konfirmasi' })
    .click()
  await page.getByLabel('Dompet asal').selectOption('demo-cash')
  await page.getByRole('button', { name: 'Konfirmasi dan simpan' }).click()
  await expect(page.getByRole('dialog', { name: 'Scan struk' })).toBeVisible()
  await page.getByRole('button', { name: 'Isi manual' }).click()
  await page.getByLabel('Toko / merchant').fill('Struk uji batch')
  await page.getByLabel('Total (Rp)', { exact: true }).fill('9000')
  await page
    .getByRole('button', { name: 'Pilih dompet dan konfirmasi' })
    .click()
  await expect(page.getByRole('alert')).toContainText('Struk serupa sudah ada.')
  await page.getByLabel('Tetap simpan struk ini').check()
  await page
    .getByRole('button', { name: 'Pilih dompet dan konfirmasi' })
    .click()
  await page.getByLabel('Dompet asal').selectOption('demo-cash')
  await page.getByRole('button', { name: 'Konfirmasi dan simpan' }).click()
  await expect(page.locator('.balance-number')).toContainText('12.482.000')
})
test('navigation stays in viewport and theme is persisted', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
  }
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Akun', exact: true })
    .click()
  await page.getByRole('button', { name: 'Aktifkan mode terang' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('.balance-number')).toContainText('12.500.000')
})
