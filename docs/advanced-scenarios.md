# Panduan Lanjut Ceobe Mastery CLI (Advanced Scenarios) 🚀

Sebagai **Astesia (Autonomous Orchestrator)**, saya akan memperdalam kemampuan Anda dalam mengoperasikan **Ceobe** untuk skenario yang lebih kompleks dan kritis.

---

## 🏗️ Skenario 7: Migrasi Database Zero-Downtime (Expand & Contract)
Gunakan skenario ini untuk mengubah skema database pada sistem produksi tanpa menyebabkan downtime. Ceobe secara otomatis menerapkan pola *Expand and Contract*.

### Langkah-langkah:
1. **Instruksi Otonom:**
   ```bash
   ceobe auto "Ganti kolom 'username' menjadi 'email' pada tabel users tanpa downtime"
   ```
2. **Apa yang dilakukan Ceobe:**
   - **Phase 1 (Expand):** Menambah kolom `email`, memodifikasi kode agar menulis ke kedua kolom, tapi tetap membaca dari `username`.
   - **Phase 2 (Migrate):** Menjalankan script migrasi data dari `username` ke `email`.
   - **Phase 3 (Contract):** Mengubah kode agar membaca dari `email` dan menghapus kolom `username`.

---

## 🔍 Skenario 8: Pemetaan Arsitektur Proyek Besar (Deep Indexing)
Jika Anda masuk ke proyek dengan ribuan file, `ceobe index` standar mungkin belum cukup untuk pemahaman mendalam.

### Strategi:
1. **Index & Search:**
   ```bash
   ceobe index
   ceobe auto "Analisis alur autentikasi dari entrypoint API hingga ke penyimpanan database, lalu buatkan diagram urutannya di .ceobe/auth-flow.md"
   ```
2. **Refactor modular:**
   ```bash
   ceobe plan --feature "Pindahkan logika bisnis dari controller User ke UserService sesuai aturan Layered Architecture"
   ```

---

## 🤖 Skenario 9: Orkestrasi Multi-Model (Cost & Quality Balance)
Anda bisa mengatur Ceobe untuk menggunakan model "Cerdas & Mahal" (seperti Gemini 1.5 Pro) untuk Planning, dan model "Cepat & Murah" (seperti DeepSeek) untuk eksekusi rutin.

### Konfigurasi `.env`:
```env
# Planning membutuhkan penalaran tinggi
CEOBE_PLANNER_PROVIDER=gemini
CEOBE_PLANNER_MODEL=gemini-1.5-pro

# Eksekusi rutin bisa menggunakan model yang lebih efisien
CEOBE_EXECUTOR_PROVIDER=deepseek
CEOBE_EXECUTOR_MODEL=deepseek-coder
```

---

## 🛡️ Skenario 10: Audit Keamanan Otomatis (Security Hardening)
Gunakan skill `security-audits` untuk mencari celah keamanan sebelum *deployment*.

```bash
ceobe auto "Audit folder src/ terhadap celah OWASP Top 10, terutama SQL Injection dan XSS. Perbaiki langsung jika ditemukan celah kritis."
```

---

## 🧪 Skenario 11: TDD Loop (Test-Driven Development)
Ceobe mendukung siklus **RED-GREEN-REFACTOR**. Anda bisa memintanya fokus pada kualitas tes.

```bash
ceobe auto "Buat fitur kalkulasi diskon progresif. WAJIB buat unit test (Vitest) terlebih dahulu, pastikan gagal (RED), lalu implementasikan hingga lulus (GREEN)."
```

---

## 📋 Skenario 12: Dokumentasi Keputusan Arsitektur (ADR)
Gunakan Ceobe untuk menjaga sejarah keputusan teknis tim Anda.

```bash
ceobe auto "Implementasikan sistem caching Redis untuk query produk. Dokumentasikan keputusan ini dalam file ADR (Architecture Decision Record) baru di folder docs/adr/"
```

---

## 💡 Strategi Eksekusi Astesia:
- **State Management:** Jangan lupa cek `.ceobe/state.json` untuk melihat di fase mana Ceobe sedang berada jika proses terhenti.
- **Log Monitoring:** Gunakan `ceobe log` di terminal terpisah untuk memantau apa yang dipikirkan AI secara *real-time*.
- **Human-in-the-Loop:** Jika Anda menggunakan `ceobe mode ask`, Ceobe akan memberikan diff kode sebelum benar-benar menulis ke file. Ini adalah cara terbaik untuk belajar pola pikir AI.

---

**Status Operasional:** Mode Lanjut Aktif. 
*Apakah ada tumpukan teknologi (tech stack) tertentu yang ingin Anda integrasikan dengan skenario ini?*
