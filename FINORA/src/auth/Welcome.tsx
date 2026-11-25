import { useState } from 'react'
import {
  Wallet,
  ScanLine,
  ChartNoAxesColumnIncreasing,
  Cloud,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Brand } from '../layouts/Shell'
import { Field, Form, str } from '../components/ui'
import type { Profile } from '../types'
import { pinHash, salt } from './pin'
const steps = [
  {
    Icon: Wallet,
    title: 'Kelola keuangan dengan tenang',
    body: 'Catat pemasukan, pengeluaran, dan transfer. Pisahkan dana Cash dan Online dalam workspace Personal dan Business.',
  },
  {
    Icon: ScanLine,
    title: 'Catat dari foto struk',
    body: 'Ambil foto atau pilih screenshot pembayaran. FINORA membaca isian dan memberi Anda kesempatan untuk memeriksanya.',
  },
  {
    Icon: ChartNoAxesColumnIncreasing,
    title: 'Pahami arus kas Anda',
    body: 'Lihat statistik, siapkan anggaran, dan pantau target tabungan.',
  },
  {
    Icon: Cloud,
    title: 'Simpan ke Google Sheets privat',
    body: 'Gunakan spreadsheet milik Anda atau coba FINORA dengan data demo yang tersimpan di perangkat.',
  },
]
export function Welcome({
  demo,
  google,
  passkey,
  error,
}: {
  demo: () => Promise<void>
  google: boolean
  passkey: () => Promise<void>
  error: string
}) {
  const [step, setStep] = useState(0),
    [localError, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const { Icon, title, body } = steps[step]
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="welcome-screen">
      <div className="welcome-art">
        <img src="/icons/mark.svg" alt="" />
        <h2>FINORA</h2>
        <p>Your Money, Your Control.</p>
      </div>
      <div className="onboarding">
        <Brand />
        <span className="entry-icon gold">
          <Icon size={22} />
        </span>
        <h1>{title}</h1>
        <p className="muted">{body}</p>
        <div
          className="step-dots"
          aria-label={'Langkah ' + (step + 1) + ' dari 4'}
        >
          {steps.map((_, i) => (
            <span key={i} className={step === i ? 'active' : ''} />
          ))}
        </div>
        {step < steps.length - 1 && (
          <button className="outline" onClick={() => setStep(step + 1)}>
            Lanjut <ArrowRight size={17} />
          </button>
        )}
        {step > 0 && (
          <button className="text-link" onClick={() => setStep(step - 1)}>
            Kembali
          </button>
        )}
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(demo)}
        >
          Mulai dengan demo <ArrowRight size={17} />
        </button>
        {google && (
          <>
            <a className="outline" href="/api/login">
              Masuk dengan kode akses
            </a>
            <button
              className="outline"
              disabled={busy}
              onClick={() => void run(passkey)}
            >
              Masuk dengan Passkey
            </button>
          </>
        )}
        {(error || localError) && (
          <p className="error" role="alert">
            {localError || error}
          </p>
        )}
      </div>
    </div>
  )
}
export function PinForm({
  profile,
  save,
  unlock,
}: {
  profile: Profile
  save: (patch: Partial<Profile>) => Promise<void>
  unlock?: () => void
}) {
  return (
    <Form
      label={unlock ? 'Buka FINORA' : 'Simpan PIN'}
      save={async (f) => {
        const value = str(f, 'pin')
        if (!/^\d{6}$/.test(value))
          throw Error('PIN harus terdiri dari 6 digit.')
        if ((profile.blockedUntil || 0) > Date.now())
          throw Error('Terlalu banyak percobaan. Tunggu satu menit.')
        if (profile.pin) {
          if ((await pinHash(value, profile.salt || '')) !== profile.pin) {
            const attempts = (profile.attempts || 0) + 1
            await save({
              attempts: attempts >= 5 ? 0 : attempts,
              blockedUntil: attempts >= 5 ? Date.now() + 60_000 : 0,
            })
            throw Error(
              attempts >= 5
                ? 'Terlalu banyak percobaan. Tunggu satu menit.'
                : 'PIN keliru.',
            )
          }
          if (unlock) {
            await save({ attempts: 0, blockedUntil: 0 })
            unlock()
            return
          }
        }
        const pin = unlock ? value : str(f, 'newPin')
        if (!/^\d{6}$/.test(pin) || pin !== str(f, 'confirmation'))
          throw Error('PIN baru dan konfirmasi harus cocok.')
        const secureSalt = salt()
        await save({
          salt: secureSalt,
          pin: await pinHash(pin, secureSalt),
          attempts: 0,
          blockedUntil: 0,
        })
      }}
    >
      {profile.pin && (
        <Field label={unlock ? 'PIN 6 digit' : 'PIN saat ini'}>
          <input
            name="pin"
            type="password"
            pattern="[0-9]{6}"
            inputMode="numeric"
            maxLength={6}
            required
            autoComplete="off"
          />
        </Field>
      )}
      {!unlock && (
        <>
          <Field label="PIN baru (6 digit)">
            <input
              name="newPin"
              type="password"
              pattern="[0-9]{6}"
              inputMode="numeric"
              maxLength={6}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Konfirmasi PIN">
            <input
              name="confirmation"
              type="password"
              pattern="[0-9]{6}"
              inputMode="numeric"
              maxLength={6}
              required
              autoComplete="new-password"
            />
          </Field>
          {!profile.pin && <input type="hidden" name="pin" value="000000" />}
          <p className="muted">
            <ShieldCheck size={15} /> PIN adalah pengunci lokal tambahan. Data
            IndexedDB dapat dibaca oleh profil browser perangkat Anda.
          </p>
        </>
      )}
    </Form>
  )
}
