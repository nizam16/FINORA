# Hubungkan FINORA ke Google Sheets lewat Apps Script

Alur ini menggunakan spreadsheet dan Apps Script dari akun Google Anda. Tidak perlu membuat proyek Google Cloud sendiri, membuat OAuth client, mengaktifkan API Google Sheets atau Drive, atau memasang billing Google Cloud. Google dan hosting tetap menerapkan kuota masing-masing.

## Siapkan spreadsheet

1. Buat spreadsheet kosong di **My Drive** dan beri nama **FINORA**. Pastikan akses umum **Dibatasi** dan hanya Anda yang punya akses.
2. Buka **Ekstensi → Apps Script**. Ganti isi `Code.gs` dengan berkas `apps-script/Code.gs` dari paket FINORA, lalu simpan.
3. Buat tiga nilai acak yang berbeda. Jalankan perintah ini tiga kali di terminal lokal dan catat hasilnya secara privat.

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   Gunakan satu nilai untuk `FINORA_SCRIPT_SECRET`, satu untuk `FINORA_ACCESS_CODE`, dan satu untuk `FINORA_KEY`.
4. Di **Project Settings → Script Properties**, tambahkan `FINORA_SCRIPT_SECRET` dan isikan nilai yang sesuai. Pilih fungsi **setupFinora** lalu klik **Run**. Tinjau permintaan izin Google dan izinkan jika akun serta scriptnya benar. Built-in DriveApp memerlukan akses Drive untuk arsip struk, pemeriksaan akses privat dan laporan.
5. Pilih **Deploy → New deployment → Web app**. Atur **Execute as → Me** dan **Who has access → Anyone**. Netlify harus bisa mengirim permintaan server tanpa membuka sesi Google. Script memverifikasi tanda tangan HMAC sebelum membuka spreadsheet atau Drive. Spreadsheet tetap privat. Jika pilihan **Anyone** dibatasi administrator akun, gunakan akun yang mengizinkannya atau tetap gunakan mode demo.
6. Salin URL deployment HTTPS yang berakhir dengan `/exec`. Untuk pembaruan kode, edit deployment yang sama dan pilih versi baru agar URL tetap sama.

## Siapkan hosting HTTPS

Deploy repositori FINORA yang berisi kode dan `netlify.toml` ke hosting Netlify dengan paket gratis, jika tersedia dan kuotanya mencukupi. Unggah statis folder `dist` hanya untuk demo. Sinkronisasi memerlukan deployment project yang ikut membangun Netlify Functions.

Masukkan nilai ini ke pengaturan **Environment variables** dengan scope Functions. Jangan masukkan rahasia ke Git, spreadsheet, URL, atau chat.

| Variabel | Nilai |
| --- | --- |
| `FINORA_ORIGIN` | Origin HTTPS situs, tanpa garis miring di akhir |
| `FINORA_SCRIPT_URL` | URL Apps Script berakhiran `/exec` |
| `FINORA_SCRIPT_SECRET` | Nilai yang sama dengan Script Properties |
| `FINORA_ACCESS_CODE` | Kode rahasia khusus untuk masuk ke FINORA |
| `FINORA_KEY` | Kunci enkripsi sesi, berbeda dari dua nilai lainnya |

Deploy ulang. Buka FINORA, pilih **Masuk dengan kode akses**, lalu **Hubungkan Apps Script**. Atur PIN dan, bila tersedia, Passkey. Di perangkat kedua, gunakan situs dan kode akses yang sama. Saat menyiapkan FINORA pada perangkat kedua, lewati saldo awal lalu sinkronkan untuk menarik dompet yang sudah ada.

## Penggunaan dan batas

- Satu deployment melayani satu pemilik dan satu spreadsheet. Gunakan akun Google pemilik yang sama saat membuka tautan Sheets atau foto Drive.
- Sheet dengan nama `FINORA - …` adalah tampilan laporan yang dibuat dari snapshot tersinkron. Perubahan transaksi dilakukan di aplikasi dan perubahan manual di tab laporan akan diganti pada sinkronisasi berikutnya.
- Apps Script menyimpan foto JPEG di folder privat **FINORA - Arsip Struk Privat**. Ekspor Sheets membuat spreadsheet laporan privat terpisah.
- Jika kode akses bocor, ganti `FINORA_ACCESS_CODE` dan deploy ulang untuk mengakhiri sesi lama, lalu daftar ulang Passkey. Untuk memutus koneksi Apps Script, nonaktifkan deployment web app. Putar `FINORA_SCRIPT_SECRET` pada kedua sisi jika bocor.
- Google menerapkan kuota Apps Script, Sheets dan Drive. Netlify menerapkan kuota build, fungsi, bandwidth dan penyimpanan. FINORA tidak membutuhkan paket berbayar untuk konfigurasi ini selama penggunaan masih tercakup dalam kuota gratis.
- Opsional, Web Push memerlukan variabel VAPID pada `.env.example` dan dukungan perangkat. Buat kunci dengan `npx web-push generate-vapid-keys` dan masukkan ke Functions.

[Dokumentasi Web App Apps Script](https://developers.google.com/apps-script/guides/web) · [Kuota Apps Script](https://developers.google.com/apps-script/guides/services/quotas)
