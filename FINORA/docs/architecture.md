# Arsitektur, skema, dan keamanan

## Ledger dan penyimpanan

Satu catatan transaksi memuat arah, nominal IDR bulat positif, dan referensi sumber/tujuan. Saldo dompet adalah saldo awal ditambah seluruh kredit dikurangi debit. Transfer menulis satu catatan dua arah dan biaya opsional menulis pengeluaran tertaut dalam transaksi IndexedDB yang sama. Utang/piutang tetap terpisah dari laba/pengeluaran. Pembiayaan kas tidak masuk statistik konsumsi. Setoran target virtual tercatat di riwayat target. Pemindahan uang untuk target memakai transfer terpisah. Refund yang ditautkan mereduksi pengeluaran. Rekonsiliasi adalah penyesuaian ledger dengan alasan.

- Per akun Google atau demo, IndexedDB menyimpan snapshot data, preferensi, dan baseline sinkronisasi. Isolasi workspace mengikuti penanda Personal/Business, termasuk dompet, kategori dan laporan.
- Perubahan anggota koleksi memiliki versi, ID stabil, timestamp dan tombstone untuk penghapusan. Pencatatan berkala menggunakan UUID deterministik per rencana dan tanggal. Data default sistem memakai ID stabil.
- Singkatan ledger di Sheets mengikuti bagian transaksi dan dompet dalam spesifikasi. `Transactions` juga memuat `related_transaction_id` dan `fee_for`. `Wallets` menyertakan versi dan tombstone.
- `Categories`, `Receipts`, `Budgets`, `Savings_Goals`, `Debts`, `Receivables`, `Recurring_Transactions`, dan `Reminders` menyimpan data pendukung. Metadata foto bisa tersimpan di `Receipts`. Gambar lokal tidak dikirim ke Sheets.
- `Dashboard`, `Cash`, `Online`, `Transfers`, dan `Monthly_Reports` dihitung dari ledger. `Settings` memiliki marker skema, akun, IDR dan Asia/Jakarta. `Sync_Log` mencatat waktu dan revisi sinkronisasi. `Workspaces` memuat dua workspace. Total 18 tab. Kolom sistem dan header perlu dipertahankan.

## Sinkronisasi

Perubahan yang tersimpan lokal menjadi antrean melalui selisih dengan baseline. Sinkronisasi membaca data Sheets dan membandingkan versi dasar, versi perangkat, dan versi spreadsheet. Perubahan independen digabung. Jika keduanya mengubah data sama, pengguna meninjau detail dan memilih versi. Tombstone ikut dipertahankan. Perubahan lokal selama permintaan yang sedang berjalan ditinjau kembali terhadap baseline terbaru. Jaringan kembali aktif, aplikasi terlihat, perubahan baru, dan perintah manual dapat memicu sinkron. Percobaan ulang perubahan yang belum terkirim menggunakan exponential backoff selama aplikasi aktif.

Apps Script mengunci proses sinkronisasi dan memeriksa revisi sebelum menulis. Snapshot utuh ditulis ke slot A/B yang tidak aktif, lalu aplikasi mengganti penunjuk setelah penulisan dan laporan selesai. Jika penulisan laporan terputus, snapshot terakhir tetap bisa dibaca dan laporan dapat diperbarui pada percobaan berikutnya. Tab laporan `FINORA - …` diturunkan dari snapshot, sehingga perubahan transaksi dilakukan di aplikasi.

## Perlindungan data

- Hosting memeriksa kode akses acak dan memakai cookie sesi Secure, HttpOnly dan SameSite dengan masa berlaku 12 jam. Fungsi hosting memeriksa Origin untuk POST. Mengganti kode akses membatalkan sesi dan Passkey yang memakai kode lama.
- Fungsi hosting menandatangani permintaan Apps Script dengan HMAC-SHA256 dan waktu permintaan. Rahasia disimpan di pengaturan hosting dan Script Properties. Apps Script memeriksa bahwa spreadsheet serta arsip struk privat dan membatasi sinkronisasi ke spreadsheet yang dipilih saat setup.
- WebAuthn memeriksa origin, RP ID, verifikasi pengguna dan challenge sekali pakai. PIN membatasi akses lewat antarmuka aplikasi. Perlindungan IndexedDB bergantung pada profil browser dan perangkat.
- Teks masukan yang berpotensi diperlakukan sebagai formula ditulis sebagai literal. Snapshot disimpan dengan awalan teks dan dibagi per sel untuk menghormati batas panjang sel.
- Service worker menyimpan aset aplikasi, sementara API dan data pengguna berada di luar cache. Pencadangan dan ekspor perlu disimpan secara privat.

## Batas perangkat

Aplikasi tidak dapat menjamin background sync iOS, ketepatan OCR pada foto buruk, akses Face ID di semua browser, atau retensi IndexedDB saat browser membuang data. OCR dijalankan lokal. Batch memproses foto satu per satu agar hasil bisa ditinjau. Dukungan crop otomatis terbatas pada deteksi kertas terang di latar lebih gelap. Analisis memakai aturan dan data yang tersimpan lokal.
