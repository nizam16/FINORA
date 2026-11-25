# FINORA

**Your Money, Your Control.** Pengelola keuangan Personal dan Business dengan Rupiah bulat, zona Asia/Jakarta, serta antarmuka Black & Gold yang diadaptasi dari referensi FINORA. Tampilan iPhone menggunakan navigasi bawah. Tampilan desktop menggunakan panel samping.

## Mulai di komputer

Gunakan Node.js 22.12+ LTS (atau seri 24 LTS) dan npm. Buka Terminal, PowerShell, atau Command Prompt di folder proyek.

```sh
npm ci
npm run dev
```

Buka alamat localhost yang dicetak, lalu pilih **Mulai dengan demo**. Saldo awal demo Personal Rp12.500.000, terdiri dari Cash Rp2.500.000 dan Online Rp10.000.000. Arus kas bulan berjalan Rp5.500.000. Workspace Business dimulai kosong. Data demo tersimpan terpisah dalam IndexedDB perangkat.

Gunakan build produksi untuk menguji pemasangan dan offline. Jalankan `npm run build`, lalu `npm run preview`. Buka aplikasi sekali sampai dashboard selesai dimuat sebelum memutus jaringan. Jika paket menyertakan folder `dist`, jalankan `npm run demo` untuk membuka build tanpa menginstal dependensi proyek, atau sajikan folder tersebut pada host HTTPS. Buka lewat URL server. Mode demo tersedia tanpa kredensial.

## Cara memakai

1. Di **Beranda**, pilih **Tambah Transaksi** atau **Transfer Dana**. Transfer memindahkan saldo antar-dompet. Biaya admin dicatat sebagai pengeluaran terpisah. Refund mengurangi pengeluaran lewat transaksi asal.
2. Di **Scan Struk**, pilih kamera atau satu/beberapa foto dari galeri. Gunakan rotasi, potong tepi, atau perbaikan kontras bila perlu. Baca OCR, tinjau hasil, pilih jenis dan dompet, lalu konfirmasi setiap struk. Untuk foto yang sulit terbaca, gunakan **Isi manual**.
3. Di **Dompet**, tambahkan Cash atau Online. Untuk mengoreksi saldo, buka dompet dan pilih **Rekonsiliasi**. FINORA menulis penyesuaian dengan alasan dan riwayatnya.
4. Di **Akun**, atur kategori, anggaran, target, utang/piutang, pengingat, PIN, tema, dan cadangan. Pilih workspace di bagian atas. Pindah workspace akan mengubah cakupan halaman.
5. Di **Statistik**, pilih periode dan filter. Unduh CSV, XLSX, PDF, atau ekspor ke spreadsheet privat setelah Google tersedia.
6. Cadangkan data secara berkala melalui **Akun → Backup, pemulihan & ekspor**. Penyimpanan browser bisa dihapus oleh sistem atau pengguna. Restore JSON mengganti data lokal setelah konfirmasi. Jika Google Sheets terhubung, perubahan yang dipulihkan ikut antrean sinkronisasi dan konflik tetap perlu ditinjau.

## Konfigurasi dan pemasangan

- [Konfigurasi Apps Script, Google Sheets, dan Drive](docs/google.md)
- [Deploy ke Netlify dan pasang di iPhone](docs/deployment.md)
- [Skema, sinkronisasi, dan keamanan](docs/architecture.md)
- [Status pengujian dan batas fitur](docs/verification.md)
- [Spesifikasi referensi](docs/FINORA_MASTER_PROMPT.md)

## Pengujian

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run e2e
```

Unit test memakai ledger, parser struk, format data Sheets, dan handler API. Pengujian Playwright membuka build produksi pada localhost. Satu skenario memakai API Google simulasi secara eksplisit. Untuk emulasi iPhone tambahan, jalankan `npx playwright install webkit` dan `npm run e2e:webkit` pada host dengan dependensi WebKit. Jalankan penerimaan Google dan iPhone terpisah setelah deploy sesuai panduan.

## Struktur proyek

- `src/pages`, `src/layouts`, `src/components`, `src/styles` memuat halaman, pola navigasi, dan tema FINORA.
- `src/features`, `src/utils`, `src/types` memuat fitur ledger, rencana, grafik, laporan, dan validasi.
- `src/database`, `src/auth`, `src/sync`, `src/ocr` menangani data, pengunci lokal, rekonsiliasi versi, dan OCR.
- `public/icons` memuat logo transparan/horizontal, ikon PWA, ikon Apple, dan aset splash. `scripts` mengemas OCR dan service worker.
- `backend/functions/api.mjs` menangani endpoint depan. `backend/apps-script.mjs` menandatangani permintaan, dan `apps-script/Code.gs` menyimpan data ke Sheets dan Drive.
- `src/tests` dan `e2e` memuat pengujian. `netlify.toml` mengatur deploy.

FINORA tidak memerlukan kredensial m-banking atau layanan AI berbayar.
