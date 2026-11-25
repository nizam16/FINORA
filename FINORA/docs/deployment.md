# Deploy dan pemasangan iPhone

## Netlify

1. Untuk build yang menyertakan backend, simpan isi folder proyek dalam repositori privat Anda. Ikuti panduan Google untuk menyiapkan deployment Apps Script dan variabel sesuai domain Netlify. `.env.example` adalah template. Rahasia hanya dimasukkan ke pengaturan Functions di Netlify.
2. Import repositori ke Netlify. Gunakan root proyek sebagai base. `netlify.toml` menetapkan build `npm run build`, folder publish `dist`, dan fungsi `backend/functions`.
3. Deploy ke URL HTTPS yang sama dengan `FINORA_ORIGIN`. Uji `/api/session` lewat browser. Dengan backend tanpa konfigurasi, JSON berisi `google: false`. Setelah variabel dipasang dan deploy ulang, respons menunjukkan `google: true`.
4. Untuk demo statis saja, unggah isi folder `dist` ke host HTTPS yang menyajikan file pada root domain. Netlify Drag and Drop dapat menyajikan demo statis. Deploy statis menjalankan IndexedDB, OCR, dan PWA. Sinkronisasi Apps Script memerlukan deploy proyek beserta backend.
5. Jalankan tes penerimaan sebelum memasukkan data sungguhan. Catat pemasukan Cash, pengeluaran Online, transfer dengan biaya admin, dan perubahan dari perangkat kedua. Periksa saldo, baris ledger, hasil ekspor, dan status izin dari akun pemilik.

## iPhone

1. Buka alamat **HTTPS** FINORA di Safari.
2. Tunggu halaman sampai masuk atau demo siap.
3. Ketuk **Bagikan**, gulir ke **Tambahkan ke Layar Utama**, lalu ketuk **Tambah**. Jika iOS menampilkan opsi **Buka sebagai App Web**, aktifkan.
4. Buka FINORA dari ikon emas. Uji input nominal, izin kamera, unggah galeri, dan pemindaian pada struk Anda.
5. Untuk tes offline, buka FINORA sekali saat online. Setelah itu aktifkan Mode Pesawat, buka kembali FINORA dari Layar Utama, catat transaksi, sambungkan jaringan, dan buka FINORA lagi. Cek perubahan muncul satu kali di spreadsheet terhubung.
6. Penyimpanan dan sesi dapat berbeda antara tab Safari dan ikon layar utama. Jika diminta, login kembali di aplikasi yang dibuka dari ikon. Cadangkan data lokal secara berkala.

Jika browser tidak menyediakan input kamera langsung, pilih foto dari galeri. Passkey memerlukan autentikator yang didukung. Sinkronisasi dan pencatatan berulang dipicu saat aplikasi aktif atau dibuka kembali. Notifikasi saat aplikasi tertutup memerlukan konfigurasi VAPID dan izin perangkat. Ikuti bagian Web Push di panduan Google.

Panduan Apple [menjadikan situs sebagai app di iPhone](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios).
