import { useEffect, useState } from 'react'
import { Camera, ImagePlus, RotateCw, ScanLine } from 'lucide-react'
import type { Data, Kind, Receipt } from '../types'
import { base, duplicateReceipt, today } from '../utils/ledger'
import { Field, Form, num, str } from '../components/ui'
import {
  dataURL,
  digest,
  editImage,
  recognize,
  parseReceipt,
} from '../ocr/receipt'
export function Scanner({
  workspace,
  data,
  queue = [],
  next,
}: {
  workspace: string
  data: Data
  queue?: File[]
  next: (r: Receipt, kind: Kind, rest: File[]) => void
}) {
  const [file, setFile] = useState<File>(queue[0]),
    [rest, setRest] = useState(queue.slice(1)),
    [autoCrop, setAutoCrop] = useState(false),
    [preview, setPreview] = useState(''),
    [rotation, setRotation] = useState(0),
    [crop, setCrop] = useState(0),
    [enhance, setEnhance] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<Receipt>(),
    [image, setImage] = useState(''),
    [allowDuplicate, setAllowDuplicate] = useState(false)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function choose(list: FileList | null) {
    const selected = Array.from(list || []).slice(0, 15)
    setFile(selected[0])
    setRest(selected.slice(1))
    setRotation(0)
    setCrop(0)
    setError('')
  }
  async function run(manual: boolean) {
    setError('')
    setBusy(true)
    setProgress(0)
    try {
      if (file && file.size > 24_000_000)
        throw Error('Ukuran foto melebihi 24 MB.')
      const hash = file ? await digest(file) : crypto.randomUUID()
      const blob = file
        ? await editImage(file, rotation, crop, enhance, autoCrop)
        : undefined
      setImage(blob ? await dataURL(blob) : '')
      const result =
        manual || !blob
          ? parseReceipt('', workspace, hash, 0)
          : await recognize(blob, workspace, hash, setProgress)
      setReceipt(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR gagal. Coba isi manual.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <p className="muted">
        Ambil foto struk atau pilih screenshot pembayaran. Periksa hasil sebelum
        mencatat transaksi.
      </p>
      {!receipt && (
        <>
          <div className="quick-grid scanner-actions">
            <label className="outline">
              <Camera size={20} /> Kamera
              <input
                className="visually-hidden"
                type="file"
                aria-label="Foto dari kamera"
                accept="image/*"
                capture="environment"
                disabled={busy}
                onChange={(e) => choose(e.target.files)}
              />
            </label>
            <label className="outline">
              <ImagePlus size={20} /> Galeri
              <input
                className="visually-hidden"
                type="file"
                aria-label="Foto dari galeri"
                multiple
                accept="image/*"
                disabled={busy}
                onChange={(e) => choose(e.target.files)}
              />
            </label>
          </div>
          {rest.length > 0 && (
            <p className="muted">
              {rest.length + 1} foto dalam antrean. Konfirmasi setiap struk.
            </p>
          )}
          {file && (
            <>
              <div className="image-preview">
                <img
                  src={preview}
                  alt="Pratinjau struk"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    clipPath: `inset(${crop}%)`,
                    filter: enhance ? 'grayscale(1) contrast(1.45)' : '',
                  }}
                />
              </div>
              <div className="form-grid">
                <button
                  disabled={busy}
                  className="outline"
                  onClick={() => setRotation((rotation + 90) % 360)}
                >
                  <RotateCw size={16} /> Rotasi
                </button>
                <Field label="Potong tepi">
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={crop}
                    disabled={busy}
                    onChange={(e) => setCrop(Number(e.target.value))}
                  />
                </Field>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={enhance}
                  onChange={(e) => setEnhance(e.target.checked)}
                />{' '}
                Tingkatkan kontras
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                />{' '}
                Deteksi tepi kertas (opsional)
              </label>
            </>
          )}
          {busy && (
            <div role="status">
              <progress max="1" value={progress} />
              <p>Memproses OCR · {Math.round(progress * 100)}%</p>
            </div>
          )}
          <div className="quick-grid scanner-actions">
            <button
              className="primary"
              disabled={!file || busy}
              onClick={() => void run(false)}
            >
              <ScanLine size={18} /> Baca struk
            </button>
            <button
              className="outline"
              disabled={busy}
              onClick={() => void run(true)}
            >
              Isi manual
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {receipt && (
        <>
          <p className={receipt.confidence < 75 ? 'warning' : 'muted'}>
            {receipt.confidence
              ? 'Akurasi OCR ' + Math.round(receipt.confidence) + '%. '
              : ''}
            {receipt.confidence < 75
              ? 'Periksa ulang semua isian.'
              : 'Tinjau hasil sebelum melanjutkan.'}
          </p>
          <Form
            label="Pilih dompet dan konfirmasi"
            save={(f) => {
              const result = {
                ...base(workspace, receipt.id),
                ...receipt,
                merchant: str(f, 'merchant'),
                address: str(f, 'address'),
                date: str(f, 'date'),
                time: str(f, 'time'),
                number: str(f, 'number'),
                amount: num(f, 'amount'),
                subtotal: num(f, 'subtotal'),
                discount: num(f, 'discount'),
                tax: num(f, 'tax'),
                fee: num(f, 'fee'),
                method: str(f, 'method'),
                items: str(f, 'items'),
                image: f.has('image') ? image : undefined,
              }
              if (duplicateReceipt(result, data.receipts) && !allowDuplicate) {
                setAllowDuplicate(true)
                throw Error(
                  'Struk serupa sudah ada. Centang konfirmasi untuk melanjutkan.',
                )
              }
              if (allowDuplicate && !f.has('duplicate'))
                throw Error('Tinjau dan konfirmasi kemungkinan duplikat.')
              next(result, str(f, 'kind') as Kind, rest)
            }}
          >
            <Field label="Jenis transaksi">
              <select
                name="kind"
                defaultValue={
                  /transfer/i.test(receipt.method + ' ' + receipt.text)
                    ? 'transfer'
                    : 'expense'
                }
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
                <option value="transfer">Transfer</option>
              </select>
            </Field>
            <Field label="Toko / merchant">
              <input
                name="merchant"
                maxLength={120}
                defaultValue={receipt.merchant}
              />
            </Field>
            <Field label="Alamat">
              <input name="address" defaultValue={receipt.address} />
            </Field>
            <div className="form-grid">
              <Field label="Nomor struk">
                <input name="number" defaultValue={receipt.number} />
              </Field>
              <Field label="Tanggal">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={receipt.date || today()}
                />
              </Field>
              <Field label="Waktu">
                <input name="time" type="time" defaultValue={receipt.time} />
              </Field>
              <Field label="Metode bayar">
                <input name="method" defaultValue={receipt.method} />
              </Field>
            </div>
            <Field label="Item · jumlah · harga">
              <textarea name="items" defaultValue={receipt.items} />
            </Field>
            <div className="form-grid">
              {(
                [
                  ['subtotal', 'Subtotal'],
                  ['discount', 'Diskon'],
                  ['tax', 'Pajak'],
                  ['fee', 'Biaya'],
                  ['amount', 'Total'],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label + ' (Rp)'}>
                  <input
                    name={k}
                    type="number"
                    min={k === 'amount' ? 1 : 0}
                    max="1000000000000"
                    step="1"
                    defaultValue={receipt[k] || ''}
                    required={k === 'amount'}
                  />
                </Field>
              ))}
            </div>
            {receipt.text && (
              <details>
                <summary>Teks hasil OCR</summary>
                <pre>{receipt.text}</pre>
              </details>
            )}
            {image && (
              <label className="check">
                <input name="image" type="checkbox" /> Simpan foto di arsip
                lokal
              </label>
            )}
            {allowDuplicate && (
              <label className="check">
                <input name="duplicate" type="checkbox" /> Tetap simpan struk
                ini
              </label>
            )}
          </Form>
          <button
            className="outline"
            onClick={() => {
              setReceipt(undefined)
              setAllowDuplicate(false)
            }}
          >
            Ganti foto atau ulangi OCR
          </button>
        </>
      )}
    </>
  )
}
