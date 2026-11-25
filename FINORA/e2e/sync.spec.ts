import { expect, test } from '@playwright/test'
import { empty, revise } from '../src/utils/ledger'
import type { Data } from '../src/types'
test.use({ serviceWorkers: 'block' })
test('onboarding, offline queue, retry and conflict review with simulated Sheets', async ({
  page,
  context,
}) => {
  const sheet = 'simulated-finora-spreadsheet'
  let remote: Data = empty(),
    revision = 0,
    fail = false
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.slice(5)
    const send = (json: unknown, status = 200) =>
      route.fulfill({ status, json })
    if (path === 'session')
      return send({
        google: true,
        session: {
          id: 'google-simulated',
          email: 'finance@example.test',
          name: 'Simulasi',
        },
      })
    if (path === 'sheet/connect') return send({ sheet })
    if (path === 'sheet/read')
      return send({ data: remote, revision: String(revision) })
    if (path === 'sheet/write') {
      if (fail) {
        fail = false
        return send({ error: 'Kuota simulasi tercapai.' }, 429)
      }
      const body = route.request().postDataJSON()
      if (body.revision !== String(revision))
        return send({ error: 'Spreadsheet berubah.' }, 409)
      remote = body.data
      revision++
      return send({ ok: true })
    }
    return send({ error: 'Rute pengujian tidak ditemukan.' }, 404)
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hubungkan Apps Script' }).click()
  await page.getByLabel('PIN baru (6 digit)').fill('123456')
  await page.getByLabel('Konfirmasi PIN').fill('123456')
  await page.getByRole('button', { name: 'Simpan PIN' }).click()
  await page.getByRole('button', { name: 'Lewati untuk sekarang' }).click()
  await page.getByLabel('Nama dompet').fill('Kas Simulasi')
  await page.getByLabel('Saldo awal (Rp)').fill('125000')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await page.getByRole('button', { name: 'Masuk dashboard' }).click()
  await expect(page.locator('.balance-number')).toContainText('125.000')
  const sync = () =>
    page.getByRole('button', { name: 'Sinkronisasi', exact: true }).click()
  await sync()
  await page.getByLabel('Sinkronisasi otomatis').click()
  await expect(page.getByLabel('Sinkronisasi otomatis')).not.toBeChecked()
  await page.getByRole('button', { name: 'Sinkronkan sekarang' }).click()
  await expect.poll(() => remote.wallets.length).toBe(1)
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Tambah Transaksi' }).click()
  await page.getByLabel('Jenis', { exact: true }).selectOption('expense')
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('30000')
  await page.getByLabel('Dompet asal').selectOption(remote.wallets[0].id)
  await page.getByLabel('Merchant').fill('Antrean offline')
  await page.getByRole('button', { name: 'Simpan transaksi' }).click()
  await expect(page.locator('.balance-number')).toContainText('95.000')
  expect(remote.entries).toHaveLength(0)
  await context.setOffline(false)
  await sync()
  fail = true
  await page.getByRole('button', { name: 'Sinkronkan sekarang' }).click()
  await expect(page.getByText('Kuota simulasi tercapai.')).toBeVisible()
  await page.getByRole('button', { name: 'Sinkronkan sekarang' }).click()
  await expect.poll(() => remote.entries.length).toBe(1)
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()
  await page.getByRole('button', { name: /Antrean offline/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Merchant').fill('Versi perangkat')
  await page.getByRole('button', { name: 'Simpan transaksi' }).click()
  remote.entries[0] = revise(remote.entries[0], {
    merchant: 'Versi spreadsheet',
  })
  revision++
  await sync()
  await page.getByRole('button', { name: 'Sinkronkan sekarang' }).click()
  await expect(
    page.getByText('Tinjau konflik untuk melanjutkan.'),
  ).toBeVisible()
  await page.getByRole('dialog').getByRole('combobox').selectOption('remote')
  await page.getByRole('button', { name: 'Terapkan pilihan konflik' }).click()
  await expect(page.getByText('Sinkronisasi selesai.')).toBeVisible()
  expect(remote.entries).toHaveLength(1)
  expect(remote.entries[0].merchant).toBe('Versi spreadsheet')
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Versi spreadsheet/ }),
  ).toBeVisible()
})
