# FINORA — Master Prompt for Codex / Claude Code

Bertindak sebagai senior full-stack developer, UI/UX designer, security engineer dan PWA specialist. Bangun aplikasi nyata, bukan mockup. Buat seluruh file, jalankan build dan pengujian, perbaiki error. Jangan mengklaim integrasi berhasil tanpa pengujian.

## Identitas dan platform
FINORA — Your Money, Your Control. Personal & Business Finance Manager, bahasa Indonesia, Rupiah (IDR, integer), zona Asia/Jakarta. PWA iPhone melalui Safari Add to Home Screen, responsif Android dan desktop, dapat dikembangkan di Windows 10 tanpa Mac atau VPS wajib.

## Stack
React, TypeScript, Vite, Tailwind, Lucide, Framer Motion, Recharts, Dexie/IndexedDB, service worker dan manifest, Google OAuth 2.0, Sheets API, Drive API, backend serverless bila diperlukan, Tesseract.js, WebAuthn, Vitest dan Playwright. Gunakan versi stabil kompatibel. Google Apps Script opsional; dokumentasikan arsitektur dan biaya/kuota. Netlify atau Cloudflare Pages untuk hosting HTTPS.

## Desain Quiet Luxury × Apple Native
Dark mode default, light mode alternatif. Obsidian #0D0D0D, charcoal #1C1C1E, gold #D4AF37, champagne #E8D5A3, white #F5F5F7, secondary #8E8E93, income #30D158, expense #FF453A, transfer #0A84FF. Komposisi 70% hitam, 20% netral, 10% emas. Matte, whitespace luas, rounded 16–24px, border tipis, ikon outline, SF Pro/system font atau Inter, angka tabular, heading 24–32px, body 14–16px, saldo 30–40px. Hindari neon/glow dan tampilan trading. Safe area iOS, target sentuh 44px, reduced motion, kontras aksesibel, skeleton, bottom sheet, transisi halus. Logo monogram F emas dengan lingkaran dan tumpukan koin; buat SVG sementara jika referensi asli belum tersedia. Siapkan logo horizontal/transparan, favicon, splash, apple touch icon, PWA 192/512 dan maskable icon.

## Alur dan halaman
Splash → onboarding manfaat, Cash/Online, scanner, laporan, Sheets → login Google → izin dan pilih/buat spreadsheet → konfirmasi koneksi → PIN 6 digit dan konfirmasi → Passkey opsional → saldo awal → dashboard. Bottom navigation: Beranda, Transaksi, Statistik, Dompet, Akun. Quick actions: Tambah Transaksi, Scan Struk, Transfer Dana.
Buat halaman dashboard; tambah pemasukan/pengeluaran; pilih sumber dana/kategori; transfer; riwayat, detail, edit, hapus, pencarian/filter; statistik; dompet tambah/edit/detail/rekonsiliasi; kategori tambah/edit; laporan; budget/detail; target tabungan/detail; utang/piutang; kalender; transaksi berulang; pengingat; insights; profil/pengaturan; sinkronisasi; backup/ekspor; keamanan; tampilan; lock screen; logout. Scanner: pilih metode, kamera/galeri, crop/rotasi, progress OCR, hasil/edit, pilih dana, konfirmasi, sukses, arsip/detail, peringatan duplikat, screenshot pembayaran, batch scan tahap lanjutan. Semua tombol utama harus berfungsi.

## Dashboard
Total saldo, Cash, Online, pemasukan/pengeluaran bulan ini, arus kas bersih, grafik, transaksi terbaru, budget, target, status sync, profil/notifikasi, quick actions dan ikon mata untuk sembunyikan nominal. Demo terpisah: total Rp12.500.000, Cash Rp2.500.000, Online Rp10.000.000, pemasukan Rp8.000.000, pengeluaran Rp2.500.000, net Rp5.500.000. Akun nyata mulai kosong/saldo awal pengguna. Saldo aktual berbeda dari arus kas periode.

## Dompet dan ledger
Cash (tunai/dompet fisik) dan Online (bank/e-wallet: BCA, BRI, BNI, Mandiri, Jago, SeaBank, DANA, GoPay, OVO, ShopeePay, LinkAja, PayPal, lainnya). Tambah/edit/arsip dompet, ikon, warna, saldo awal, riwayat. Tidak meminta kredensial bank atau mengakses m-banking langsung. Saldo dihitung dari ledger. Pemasukan menambah dompet tujuan; pengeluaran mengurangi dompet sumber; transfer mengurangi asal dan menambah tujuan tanpa dihitung sebagai pemasukan/pengeluaran. Contoh BCA→Cash Rp500.000 total tetap; admin Rp2.500 dicatat pengeluaran terpisah. Edit/hapus memperbarui semua laporan. Gunakan UUID, integer Rupiah, validasi nominal, operasi atomik/idempoten. Form: jenis, nominal, Cash/Online, rekening spesifik, kategori/subkategori, tanggal/waktu, catatan, merchant, struk, tag, workspace. Dukung duplikasi, pencarian, filter.

## Kategori
Pemasukan: gaji, CPA, bisnis, freelance, komisi, bonus/THR, investasi, hadiah, refund, pendapatan digital, lainnya. Refund dapat ditautkan ke pengeluaran asal dan tidak menggandakan pendapatan. Pengeluaran: makanan/minuman, transportasi, belanja, internet/pulsa, rumah tangga, operasional bisnis, langganan digital, hosting/VPS, domain, software/AI tools, hiburan, kesehatan, keluarga, pendidikan, cicilan, donasi/sosial, biaya admin, perawatan perangkat, lainnya. Tambah/edit subkategori, ikon/warna, arsip tanpa merusak histori.

## Smart Receipt Scanner
Kamera iPhone/galeri, crop otomatis jika memungkinkan dan manual, rotasi, enhancement/kontras, OCR Tesseract.js Indonesia/Inggris, progress, saran kategori, deteksi duplikat (hash, merchant, tanggal, nominal, nomor struk), arsip privat. Ekstrak toko/alamat, nomor struk, tanggal/waktu, item, kuantitas, harga, subtotal, diskon, pajak, biaya, total, metode pembayaran jika tersedia. Tandai confidence rendah; fallback manual. Pengguna wajib review/edit, pilih Cash/Online dan rekening, lalu konfirmasi sebelum transaksi disimpan. Dukung screenshot pembayaran/transfer, jangan otomatis menganggap transfer sebagai pengeluaran. Simpan foto opsional di Google Drive privat. Batch scan tahap lanjut. Tidak wajib API AI berbayar.

## Google Sheets dan data
Spreadsheet privat milik pengguna: FINORA - Personal Finance. Tab Dashboard, Transactions, Wallets, Categories, Cash, Online, Transfers, Budgets, Savings_Goals, Debts, Receivables, Receipts, Recurring_Transactions, Reminders, Monthly_Reports, Settings, Sync_Log, Workspaces. Transactions ledger utama; Cash/Online/Transfers/laporan turunan, bukan ledger terpisah. Transactions: transaction_id, user_id, workspace_id, transaction_type, amount, source_wallet_id, destination_wallet_id, category_id, subcategory, merchant, note, transaction_date, transaction_time, receipt_id, tags, created_at, updated_at, version, deleted_at. Wallets: wallet_id, workspace_id, wallet_name, wallet_type, wallet_subtype, opening_balance, calculated_balance, icon, color, status, created_at, updated_at. UUID bukan nomor baris. Cegah formula injection. Jangan simpan PIN/password/token/secret di Sheets.

## Sync dan offline
Local-first IndexedDB, antrean offline, auto/manual sync, retry exponential backoff, UUID/idempotency, version tracking, tombstone, konflik multi-device dengan review pengguna, status dan timestamp terakhir, error recovery. Sync saat online dan app aktif kembali; jangan bergantung background sync iOS. Jangan menimpa konflik diam-diam. Isolasi data per akun/workspace; uji duplikasi dan recovery.

## Auth dan keamanan
Google OAuth, izin minimum, state/PKCE sesuai arsitektur, session expiration, secure token handling, HTTPS, CSP, validasi, XSS/CSRF protection, server authorization. Secret/refresh token bukan di frontend. PIN 6 digit dengan rate limit dan auto-lock default 1 menit; PIN pengunci lokal tambahan bukan pengganti auth server; enkripsi data sensitif sesuai threat model dan jangan mengklaim PIN mengenkripsi database jika tidak. Passkey WebAuthn opsional dengan Face ID bila didukung; fallback aman, bukan biometrik palsu. Logout/revoke session, privacy mode. Jangan buat Sheets/Drive publik.

## Statistik dan laporan
Filter hari/minggu/bulan/tahun/custom, Cash/Online/rekening/kategori/workspace. Donut kategori, bar pemasukan vs pengeluaran, line saldo, cash flow, perbandingan bulan, merchant dan pengeluaran terbesar, distribusi saldo. Ekspor CSV/XLSX/PDF/Sheets; angka konsisten ledger.

## Pengelolaan finansial
Budget per kategori/bulan/workspace, aktual/sisa/progress, peringatan 75/90/100% tanpa blokir transaksi. Target tabungan: nama, ikon, nominal, tanggal, progress, setoran/penarikan; alokasi virtual tidak mengubah saldo, pemindahan nyata transfer, tidak dihitung ganda. Utang/piutang: pihak, nominal, tanggal, jatuh tempo, cicilan, riwayat, status, reminder; pisahkan kewajiban dari kas dan klasifikasikan pokok pinjaman sebagai pembiayaan, bukan pendapatan/pengeluaran konsumsi. Workspace Personal/Business terpisah untuk dompet, transaksi, kategori, budget, laporan; gabungan opsional tanpa double count antar-workspace. Rekonsiliasi saldo aktual dengan catatan penyesuaian yang dapat diaudit.

## Kalender, recurring, insights, notifikasi
Kalender bulanan dengan pemasukan, pengeluaran, transfer, tagihan, jatuh tempo dan detail tanggal. Recurring harian/mingguan/bulanan/tahunan/custom; reminder atau auto-record opt-in, satu transaksi per periode. Insights berbasis aturan lokal: tren, kategori terbesar, budget, langganan jatuh tempo, cash flow, biaya bisnis, merchant. AI eksternal opsional hanya dengan izin eksplisit sebelum mengirim data. Notifikasi in-app untuk tagihan, pencatatan, budget, target, utang/piutang dan sync; web push hanya jika didukung dan diizinkan.

## Pengaturan
Profil, Google, workspace, Sheets/Drive, sync auto/manual, rekening/kategori, bahasa/mata uang, dark/light, PIN, Passkey, auto-lock, privacy, notifikasi, backup/restore, ekspor, bantuan, tentang, logout, hapus data dengan konfirmasi.

## PWA dan project
Manifest valid, standalone, service worker, HTTPS, offline, icon, loading, safe area, kamera/upload fallback, panduan Add to Home Screen, tanpa horizontal overflow. Dokumentasikan keterbatasan biometrik/push/background iOS. Struktur src/components, pages, layouts, features, hooks, services, database, auth, sync, ocr, utils, types, styles, assets, tests; public/icons, backend, docs. Sertakan package.json, .env.example, .gitignore, README, setup/deployment config, dokumentasi Google API dan schema, test config. Jangan commit credential.

## Roadmap dan acceptance
Phase 1: design, auth, onboarding, dashboard, ledger, dompet, kategori, transfer, Sheets, offline/sync. Phase 2: statistik, laporan, budget, workspace, tabungan, utang/piutang, rekonsiliasi. Phase 3: OCR dan arsip. Phase 4: kalender, recurring, reminder, insights, batch scan, AI opsional. Phase 5: security, performance, PWA, testing, deployment. Uji login/Sheets nyata jika credential tersedia, pemasukan/pengeluaran Cash/Online, transfer/admin, edit/hapus, saldo, budget/tabungan/utang, OCR/duplikat, offline/sync/konflik, ekspor, authorization, responsive, instalasi PWA, PIN/Passkey/logout. Tidak ada tombol utama mati, error console tak tertangani, dummy production, transaksi/saldo ganda, secret bocor atau spreadsheet publik.

## Eksekusi
Periksa environment/folder; jangan hapus file pengguna tanpa izin. Buat plan/checklist lalu implementasikan file nyata bertahap, instal dependency bila diizinkan, jalankan app, lint, typecheck, unit/E2E test, production build, perbaiki error. Demo mode tanpa credential; konfigurasi production OAuth/Sheets/Drive dengan langkah jelas untuk pemilik akun. Jangan berpura-pura integrasi atau test berhasil. Pertahankan nama FINORA, logo emas, Rupiah, Cash/Online dan Quiet Luxury. Akhiri dengan fitur selesai, struktur/file utama, cara run, setup Google API, deploy, instal iPhone, hasil test nyata, fitur belum selesai/terverifikasi, known issues dan batas PWA. Prioritaskan keamanan, stabilitas, akurasi dan performa. BUILD FINORA NOW.
