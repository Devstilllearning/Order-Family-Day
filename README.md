# 🍜 Warung Hangat: Pemesanan Makanan Berbasis QR-Code

Selamat datang di **Warung Hangat**, aplikasi full-stack pemesanan makanan berbasis QR code siap pakai (*production-ready*). Aplikasi ini dirancang untuk memberikan pengalaman memesan hidangan yang mulus bagi pelanggan lewat tampilan mobile-first dan memudahkan tim operasional lewat dashboard admin real-time berbasis Kanban dan AI.

---

## ✨ FITUR UTAMA

### 📱 Sisi Pelanggan (Mobile-First)
- **Desain Cantik (Nunito Font)**: Mengadopsi identitas visual khas Warung Hangat dengan kombinasi warna hangat (#D64C1A) dan krem muda (#FFF8F0).
- **Scan QR Code & Deteksi Meja Otomatis**: Integrasi query parameter `?table=X` otomatis mengenali nomor meja ketika di-scan.
- **Menu Dinamis**: Tab kategori yang bisa di-scroll secara horizontal lengkap dengan logo/foto berbasis emoji fallback serta lencana "Populer".
- **Kustomisasi Hidangan (Drawer Opsi)**: Kustomisasi opsional per hidangan (tingkat kepedasan untuk Bakso, tingkat gula/suhu untuk Spanish Latte/Teh Poci) lengkap dengan porsi kuantitas sebelum masuk keranjang.
- **Keranjang (Cart) Multi-Fungsional**: Fitur tambah kuantitas (+/-), edit catatan khusus (request porsi), masukan nama opsional, dan pemilihan pembayaran (Bayar di Kasir atau Scan QRIS).
- **Rincian Pelacak Berbasis WebSockets**: Alur pelacakan real-time (`Diterima` → `Sedang Diproses` → `Siap Disajikan` → `Selamat Menikmati 🍜`) yang langsung ber-update otomatis saat admin mengambil tindakan.
- **AI-Generated Greeting (Gemini 3.5 Flash)**: Pesan ramah khusus yang dihasilkan secara langsung oleh Gemini 3.5 Flash untuk menyapa hangat pelanggan setelah memesan.

### 🔑 Sisi Dashboard Admin (`/admin`)
- **Login Sistem Mulus**: Halaman otentikasi login karyawan yang aman menggunakan standard hashing Bcrypt & JWT (tersimpan aman di `localStorage`).
- **Papan Kanban Live & Real-Time**: Update status pesanan secara instan dengan drag-less status triggers. Kolom "Pesanan Baru" bergradasi merah hangat menandakan urgensi tinggi.
- **Audio Synthesizer Warning ("Ding")**: Suara bell/ding interaktif otomatis berbunyi setiap ada pesanan baru masuk tanpa repot me-refresh halaman (dilengkapi toggle Suara ON/OFF).
- **Sistem Otomasi "Auto-Terima Pesanan"**: Toggle mode Auto-Terima yang secara otomatis menyetujui pesanan dalam waktu 15 detik, lengkap dengan visual timer countdown interaktif.
- **Manajemen Menu Inline**: Membantu staf dapur melakukan perubahan harga, mengubah deskripsi, menandai menu populer, dan mengubah status ketersediaan secara langsung (out-of-stock menu akan langsung buram/habis di HP pelanggan tanpa delay).
- **Manajemen Meja & QR-Code Generator**: Menampilkan visual QR-Code dinamis untuk masing-masing Meja 1-10 yang di-seeding otomatis dengan tautan meja dinamis Restoran. Tersedia tombol kustom pengunduh file QR Code Gambar PNG.
- **Bento Stats & AI Daily Sales Insights (Gemini 3.5 Flash)**: Mengumpulkan data omset harian, jumlah transaksi harian, menu terlaris, dan menyusun kalimat rekomendasi harian otomatis menggunakan model Gemini 3.5 Flash secara langsung.

---

## 🛠️ TECH STACK

- **Frontend**: React (Vite) + Tailwind CSS v4 + Framer Motion (untuk transisi drawer/sheet animasi spring yang halus).
- **Backend**: Node.js + Express.js.
- **Real-Time Communication**: Socket.io / WebSockets.
- **Database**: PostgreSQL (Prisma ORM) — di sandbox ini diimplementasikan menggunakan **Prisma + SQLite File** untuk persistensi instan berkendala nol dan zero-configuration out-of-the-box.
- **Authentication**: JWT (JSON Web Tokens) + Bcrypt.js.
- **Artificial Intelligence**: SDK Resmi Google Gen AI (`@google/genai` dengan model super-cepat `gemini-3.5-flash`).

---

## 📁 STRUKTUR PROYEK

- `/prisma/schema.prisma` - Definisi database terstruktur menggunakan Prisma.
- `/prisma/seed.ts` - Seeding awal (3 item menu spesifik, akun admin, dan 10 meja).
- `/server.ts` - Backend controller terpadu (REST API, WebSockets, & Vite Dev Pipeline).
- `/src/types.ts` - Skema definisi tipe data TypeScript terstruktur bagi sisi Client.
- `/src/App.tsx` - Komponen routing adaptif utama pelanggan restoran.
- `/src/components/OptionsSheet.tsx` - Kustomisasi opsi bottom sheet modal.
- `/src/components/CartDrawer.tsx` - Fitur review keranjang belanja & kasir/QRIS.
- `/src/components/OrderTracker.tsx` - Pelacak pesanan real-time & salam Hangat AI.
- `/src/components/AdminPanel.tsx` - Dashboard admin bento stats, menu, meja, dan Kanban.

---

## 🚀 CARA INSTALASI & MENJALANKAN

### 1. Konfigurasi Environment (`.env`)
Salin file `.env.example` ke file `.env` di direktori utama:
```env
# Gemini API Key diimpor otomatis oleh AI Studio saat run-time (ambil dari aistudio.google.com)
GEMINI_API_KEY="AIzaSy..."

# URL Aplikasi (digunakan sebagai basis link QR Code Meja)
APP_URL="http://localhost:3000"

# Token Secret Key
JWT_SECRET="warung_hangat_secret_key_123"
```

### 2. Jalankan Migrasi Database & Seeding Awal
Untuk meluncurkan SQLite database serta populasi menu/meja/admin, jalankan perintah ini di terminal:
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 3. Luncurkan Aplikasi
Nyalakan sistem Express + React terintegrasi dalam mode development:
```bash
npm run dev
```
Aplikasi kini berjalan di **http://localhost:3000**!

---

## 🍽️ CREDENTIAL SEED DATA UNTUK PENGUJIAN

### Akun Admin:
- **Email**: `admin@warung.com`
- **Password**: `admin123`

### Menu Ter-seed:
1. **Bakso** (Rp 15.000) — *Makanan (Populer)*
2. **Spanish Latte** (Rp 18.000) — *Minuman (Populer)*
3. **Teh Poci** (Rp 8.000) — *Minuman*

### Akses Cepat Simulasi Meja Pelanggan:
- Meja 1: `http://localhost:3000/?table=1`
- Meja 3: `http://localhost:3000/?table=3`
- Untuk Admin Panel: `http://localhost:3000/admin` atau gunakan hash routing `http://localhost:3000/#/admin`
