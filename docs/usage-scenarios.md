# Panduan Penggunaan Ceobe Mastery CLI 🚀

Sebagai **Astesia (Autonomous Orchestrator)**, saya akan memberikan instruksi operasional untuk menggunakan **Ceobe** dalam berbagai skenario pengembangan. Ceobe adalah mesin eksekusi otonom yang bekerja berdasarkan pipeline terstruktur.

---

## 🛠️ Persiapan Awal (Setup)

Sebelum memulai, pastikan API Key dan konektivitas sudah siap.
- **Periksa Kesehatan Sistem:** `ceobe doctor`
- **Setup API Key:** `ceobe setup` (Interaktif) atau `ceobe key set gemini <KEY>`
- **Pilih Mode:** `ceobe mode ask` (untuk pemula/ingin kontrol) atau `ceobe mode autonomous` (untuk kecepatan penuh).

---

## 🌟 Skenario 1: Memulai Proyek Baru dari Nol (Greenfield)
Gunakan skenario ini jika Anda ingin membangun aplikasi baru dalam folder kosong.

### A. Metode Terstruktur (Manual Approval)
1. **Planning:**
   ```bash
   ceobe plan "Buat aplikasi manajemen inventaris toko buku menggunakan Next.js dan Prisma"
   ```
2. **Review & Edit:** Buka folder `.ceobe/`, tinjau `brd.md`, `architecture.md`, dan `task.md`. Sesuaikan jika ada logika bisnis yang kurang tepat.
3. **Audit:**
   ```bash
   ceobe audit
   ```
4. **Eksekusi:**
   ```bash
   ceobe execute
   ```

### B. Metode Otonom (Full Autopilot)
```bash
ceobe auto "Buat aplikasi e-commerce sederhana dengan FastAPI dan React"
```

---

## 🏗️ Skenario 2: Menambah Fitur pada Proyek Eksis (Brownfield)
Gunakan skenario ini jika Anda sudah memiliki codebase dan ingin menambah fitur baru tanpa merusak kode yang ada.

### Langkah-langkah:
1. **Indexing (Wajib):** Agar Ceobe mengenali konteks kode Anda saat ini.
   ```bash
   ceobe index
   ```
2. **Planning Fitur:**
   ```bash
   ceobe plan --feature "Tambahkan sistem autentikasi OAuth Google ke aplikasi ini"
   ```
3. **Review & Execute:**
   ```bash
   ceobe audit feature-
   ceobe execute feature-task.md
   ```

---

## 📄 Skenario 3: Menggunakan Dokumen PRD Eksternal
Jika Anda sudah memiliki dokumen spesifikasi (misal dari Product Manager dalam bentuk Markdown/Text).

```bash
ceobe plan --file ./docs/requirements-v1.md
```
*Ceobe akan membaca isi file tersebut sebagai basis pembuatan Architecture dan Task Plan.*

---

## 🐞 Skenario 4: Debugging & Self-Healing
Gunakan untuk memperbaiki bug atau error build yang sulit ditemukan.

```bash
ceobe auto "Perbaiki error 'Hydration failed' di halaman checkout dan pastikan unit test lewat"
```
*Ceobe akan menjalankan loop otonom: Mencari error -> Memperbaiki kode -> Menjalankan test -> Jika gagal, coba lagi (Self-healing).*

---

## 🎨 Skenario 5: Audit UI/UX & Visual QA
Memanfaatkan kemampuan browser Ceobe untuk melakukan audit visual pada aplikasi yang sedang berjalan.

```bash
ceobe auto "Buka http://localhost:3000, lakukan audit visual pada mode dark mode, dan pastikan kontras warna sudah sesuai standar WCAG"
```

---

## 📱 Skenario 6: Pengembangan Multi-Platform (Mobile/Desktop)
Ceobe memiliki skill spesifik untuk framework seperti Flutter atau Tauri.

**Contoh Flutter:**
```bash
ceobe auto "Buat aplikasi Flutter untuk tracking kalori makanan dengan integrasi API Spoonacular"
```

**Contoh Desktop (Tauri):**
```bash
ceobe auto "Buat aplikasi desktop (Tauri + Svelte) untuk manajemen catatan lokal terenkripsi"
```

---

## 💡 Tips Profesional dari Astesia:
- **Jangan Pelit Deskripsi:** Semakin detail deskripsi di awal (misal menyebutkan tech stack spesifik), semakin akurat Architecture yang dihasilkan.
- **Manfaatkan `.ceobe/`:** Folder ini adalah "otak" Ceobe. Jangan ragu untuk mengedit `task.md` secara manual sebelum `execute` jika Anda ingin mengarahkan AI ke pola coding tertentu.
- **Reset jika Stuck:** Jika pipeline terasa kacau, jalankan `ceobe reset --yes` untuk membersihkan memori fase saat ini dan mulai ulang planning.

---

**Status Operasional:** Siap Menjalankan Instruksi. 
*Apakah ada skenario spesifik lain yang ingin Anda jelajahi?*
