# Verifikasi FINORA

## Pengujian dalam workspace

- Lint, typecheck TypeScript, dan build produksi lulus. Bundling esbuild untuk fungsi API dan pengingat berhasil.
- 16 tes Vitest lulus untuk versi Apps Script, termasuk tanda tangan, snapshot, konflik revisi, file privat, dan pengamanan formula. Cakupan finansial meliputi saldo awal demo, pemisahan workspace, transfer dan biaya admin, refund, pembiayaan, anggaran, target, akhir bulan, penjadwalan idempoten, parser OCR, duplikat, konflik, pemulihan versi, formula injection, otorisasi API, skema Sheets, dan validasi endpoint push.
- 8 skenario Playwright Chromium lulus. Cakupan meliputi navigasi dan tata letak pada lebar 320–1440 piksel, tema, PIN/keluar, transfer dengan biaya admin/edit/hapus, data offline dan pemuatan ulang, cadangan, statistik, ekspor CSV/XLSX/PDF, pengelolaan target dan utang, rekonsiliasi, OCR pada contoh Rp55.000, serta antrean batch dan peringatan duplikat.
- API simulasi menjalankan onboarding dan alur baca/tulis Sheets, antrean offline, percobaan ulang setelah respons kuota, perubahan perangkat lain, dan resolusi konflik. Pengujian ini memeriksa perilaku aplikasi terhadap respons yang dikendalikan, dengan Apps Script dan Netlify Blobs produksi di luar lingkungan pengujian.
- Versi sebelum penggantian integrasi lulus 7 skenario Playwright WebKit pada profil iPhone 13 dalam emulasi Linux.
- Audit npm tidak melaporkan kerentanan yang diketahui untuk dependensi produksi pada saat dijalankan.

## Penerimaan yang memerlukan lingkungan pengguna

- Koneksi Apps Script, sinkronisasi antarperangkat, unggah Drive privat, dan ekspor Sheets perlu diuji pada deployment Apps Script dan Netlify pengguna.
- Passkey dengan Face ID atau autentikator fisik, izin kamera pada perangkat, pemasangan Safari Layar Utama, serta delivery Web Push nyata belum diverifikasi. Uji dengan build ter-deploy pada perangkat tujuan.
- FINORA belum dipublikasikan. Build lokal dapat digunakan dalam mode demo.

## Batas implementasi

- Spreadsheet dipilih dengan memasang Apps Script yang terikat ke file privat dan menjalankan setupFinora.
- Penyimpanan setempat mengikuti keamanan profil browser. PIN mengunci antarmuka. IndexedDB belum dienkripsi oleh FINORA.
- OCR lokal bergantung kualitas foto, format merchant, dan dukungan browser. Item hasil OCR ditampilkan sebagai baris teks yang bisa disunting. Deteksi tepi otomatis menargetkan kertas terang dengan latar lebih gelap. Batch mengantrekan maksimal 15 gambar dan meminta konfirmasi satu per satu.
- Statistik dan insights menggunakan aturan lokal. Integrasi AI eksternal opsional belum diaktifkan.
- Sinkronisasi Sheets dan pencatatan otomatis berjalan saat aplikasi aktif. Jadwal Web Push memerlukan VAPID dan izin perangkat, dan diperbarui saat FINORA aktif. Daya tahan offline juga bergantung pada kebijakan penyimpanan browser.
- Ukuran snapshot dan kuota Sheets/Netlify membatasi penggunaan skala besar. Perubahan spreadsheet langsung yang terjadi selama penulisan tidak mendapat jaminan penguncian antarklien FINORA.
