# PayPal Checkout Setup — GoO Ninks

Integrasi PayPal sudah dibuat di **Supabase project `etahuzvozoomklsqepyt`** dan terhubung ke Shopping Bag website. **Belum aktif menerima pembayaran** sampai kredensial merchant disimpan.

## A. Masukkan API PayPal ke Supabase Secrets

Buka [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/etahuzvozoomklsqepyt/settings/functions) dan masukkan:

| Key | Isi |
| --- | --- |
| `PAYPAL_CLIENT_ID` | Client ID dari aplikasi PayPal Business (Sandbox atau Live) |
| `PAYPAL_CLIENT_SECRET` | Secret dari aplikasi yang sama. **Jangan taruh di GitHub atau frontend** |
| `PAYPAL_MODE` | `sandbox` untuk tes. Ubah menjadi `live` hanya jika akun PayPal Business telah siap |
| `PAYPAL_WEBHOOK_ID` | Webhook ID dari pengaturan webhook PayPal (dibuat pada langkah B) |

`PAYPAL_PAYMENTS_ENABLED=true` **opsional** karena otomatis aktif saat Client ID + Secret terisi dan verifikasi Turnstile siap. Set `PAYPAL_PAYMENTS_ENABLED=false` untuk menonaktifkan checkout baru.

Kurs USD/IDR diambil di server dari `https://open.er-api.com/v6/latest/USD` (rate referensi harian); bila gagal atau kedaluwarsa checkout PayPal **ditolak**, bukan menebak kurs. Opsional: `PAYPAL_IDR_PER_USD` bisa digunakan untuk menetapkan rate merchant yang terkontrol. Kredit rate provider ditampilkan di form checkout.

## B. Pasang notifikasi PayPal (penting)

Di [PayPal Developer Apps & Credentials](https://developer.paypal.com/dashboard/applications), pilih app yang sama dan buat webhook:

**Webhook URL:**
`https://etahuzvozoomklsqepyt.supabase.co/functions/v1/gn-paypal-webhook`

**Event:** `PAYMENT.CAPTURE.COMPLETED`

Salin **Webhook ID**, lalu simpan pada Supabase Secrets sebagai `PAYPAL_WEBHOOK_ID`. Webhook diverifikasi secara server-side terhadap API PayPal sebelum memindahkan status pesanan menjadi `paid`. Tanpa Webhook ID, pembayaran masih dapat diverifikasi saat pelanggan kembali ke halaman status, tetapi notifikasi otomatis bila browser ditutup belum berfungsi.

## C. Alur pembeli

1. Shopping Bag → Continue to Payment → **International Payment (PayPal)**.
2. Isi nama, email, telepon dan alamat lengkap. Shipping **belum termasuk**.
3. Lengkapi verifikasi keamanan → tombol **PayPal**.
4. Server cek stok, promo, jumlah IDR dan kurs USD/IDR; membuat pesanan PayPal.
5. Pembeli menyetujui pembayaran di domain PayPal, kembali ke `payment-status.html`.
6. Server menangkap/memeriksa pembayaran via PayPal dan mencocokkan **order ID, nominal USD, currency, dan IDR** sebelum mengubah status ke `paid` serta memproses antrean pesanan.

Saat kunci belum dikonfigurasi, UI menampilkan status **Belum aktif** dan tidak meminta pembayaran palsu. DOKU tetap tersedia untuk checkout lokal.

## D. Uji sebelum Live

Gunakan Client ID + Secret dari Sandbox, set `PAYPAL_MODE=sandbox`, lalu lakukan pembelian uji end-to-end. Pastikan pesanan masuk dengan `GN-PP-`, status pending sebelum pembayaran, paid setelah capture verified, stok/reservasi konsisten, dan nominal USD sesuai kurs.

Setelah lulus Sandbox, ganti ke Live credentials + `PAYPAL_MODE=live` dan webhook Live terpisah. Biaya pemrosesan PayPal dan selisih kurs PayPal dengan kurs referensi dapat berlaku.

## Kode dan keamanan

- `supabase/functions/gn-paypal-checkout/index.ts`: membuat serta memverifikasi pesanan.
- `supabase/functions/gn-paypal-webhook/index.ts`: menerima webhook dengan verifikasi tanda tangan.
- `gn-midtrans.js`: checkout lokal tetap berjalan, opsi PayPal aktif otomatis setelah konfigurasi.
- `gn-payment-status.js`: menangani halaman kembali PayPal.
- Tabel `gn_paypal_payments` ber-RLS dan tidak dapat dibaca `anon` atau `authenticated`; akses hanya server.
- Kredensial **tidak pernah ditulis ke repository**; simpan hanya di Secrets.

Catatan: tidak ada proses pembayaran Live yang dapat diuji sebelum kredensial merchant tersedia.
