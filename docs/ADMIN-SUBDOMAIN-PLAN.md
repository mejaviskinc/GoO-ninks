# GoO Ninks — Rencana Subdomain Admin

Status: rencana teknis, **belum membuat subdomain atau mengubah DNS**.

## Arsitektur yang dianjurkan

- `https://gooninks.co.id/`: storefront dan halaman publik (Koleksi, Special Price, Wastra, Cerita Kami, Jurnal, Kontak).
- `https://admin.gooninks.co.id/`: dashboard internal khusus admin / staff.
- Jangan pindahkan katalog ke `shop.gooninks.co.id` bila belum ada kebutuhan operasional untuk toko terpisah. Ini menjaga pengalaman belanja dan SEO tetap sederhana.

## Kondisi source saat ini

- Repository storefront: `mejaviskinc/GoO-ninks`.
- Website sekarang memakai `CNAME` berisi `gooninks.co.id` untuk GitHub Pages.
- Dashboard sekarang masih berupa `admin.html` di repository yang sama; **subdomain admin belum aktif**.
- Jangan hanya mengarahkan DNS `admin` ke website utama dan menganggap dashboard sudah terpisah. Subdomain adalah hostname, bukan pembatas izin aplikasi.

## Tahapan implementasi yang aman

1. **Siapkan deployment dashboard sendiri** (disarankan proyek hosting atau repository terpisah). Salin aset dashboard yang dibutuhkan (`admin.html`, JavaScript/CSS, logo), lalu sesuaikan jalur aset agar valid untuk hostname admin.
2. Pertahankan `gooninks.co.id` dan file `CNAME` storefront sekarang; jangan diubah menjadi subdomain admin.
3. Sambungkan `admin.gooninks.co.id` ke deployment **yang benar**, melalui panel penyedia DNS yang authoritative:
   - **Hostinger hosting**: buat website/subdomain melalui hPanel dan gunakan record yang disediakan oleh hosting.
   - **GitHub Pages dengan repository dashboard terpisah**: atur Custom domain di Settings > Pages pada repository dashboard, lalu buat CNAME DNS `admin` ke hostname Pages yang diberikan GitHub (biasanya `mejaviskinc.github.io` bila itu memang endpoint repository terkait).
4. Aktifkan HTTPS dan uji sertifikat sebelum login admin.
5. Perbarui URL redirect/callback yang diizinkan di Supabase Auth ke hostname admin; uji login/logout, reset password, dan penyegaran session. Periksa CORS aplikasi/API bila lintas origin.
6. Pastikan **RLS Supabase** diterapkan untuk setiap tabel sensitif dan verifikasi role admin di server/database, bukan hanya menyembunyikan menu di browser. Jangan pernah simpan Midtrans Server Key atau service-role Supabase di frontend.
7. Uji dashboard di desktop dan HP, seluruh modul, upload gambar, stok, promosi, hingga order sebelum cutover.
8. Setelah lolos tes, nonaktifkan atau redirect jalur `gooninks.co.id/admin.html` pada source publik. Jangan matikan jalur lama terlebih dahulu, agar akses admin tidak terputus.
9. Opsional: noindex untuk login admin (bukan mekanisme keamanan), batasi akses atau tambah MFA bila sesuai kebutuhan.

## Checklist sebelum go-live

- [ ] `gooninks.co.id` tetap berjalan normal.
- [ ] Subdomain admin meresolusi DNS dan memakai HTTPS valid.
- [ ] Aset logo, CSS, JS dashboard tidak 404.
- [ ] Login, reset password dan izin per peran lolos uji.
- [ ] Data/fitur dashboard tidak terbuka tanpa autentikasi dan otorisasi.
- [ ] Tidak ada secret API di repository atau JavaScript yang dikirim ke browser.
- [ ] Integrasi Supabase, transaksi/pesanan, konten, gambar dan promosi lolos uji.
- [ ] Cutover dari halaman admin lama baru dilakukan setelah subdomain aktif.

## Referensi

- GitHub Pages custom domain: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- Hostinger subdomain: https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/
