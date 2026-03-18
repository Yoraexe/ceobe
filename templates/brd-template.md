# Business Requirement Document (BRD)
**Project Name:** [Nama Sistem/Aplikasi]
**Version:** 1.0
**Status:** Draft / Approved

---

## 1. Executive Summary & Objective
* **Problem Statement:** Jelaskan masalah spesifik yang ingin diselesaikan. Jangan cuma permukaan, gali sampai ke *pain point* utamanya.
* **Primary Objective:** Apa gol utama yang ingin dicapai? (Misal: Automasi sistem approval, mengurangi latency data, dll).
* **Out of Scope:** Sebutkan apa yang **TIDAK** akan dibuat di fase ini untuk menghindari *scope creep*.

---

## 2. Target Users & Stakeholders
Gunakan tabel agar AI divisi coding paham hak akses (RBAC) sejak awal:

| User Role | Responsibilities / Goals | Permissions Level |
| :--- | :--- | :--- |
| [Admin] | [Manage users & system config] | [Superuser] |
| [Customer] | [Purchase & track orders] | [Limited Access] |

---

## 3. Core Features & Business Rules
Bagian paling krusial. Jangan cuma list fitur, tapi masukkan logika bisnisnya.

### 3.1 [Feature Name 1]
* **Description:** Penjelasan singkat fitur.
* **Business Rules:**
    * [Rule 1: Misal, "User harus verifikasi email sebelum bisa transaksi"].
    * [Rule 2: Misal, "Data transaksi tidak boleh dihapus, gunakan status 'soft-delete'"].
* **Acceptance Criteria (Definition of Done):**
    * [Kriteria 1: User bisa melihat riwayat transaksi dalam < 2 detik].
* **Edge Cases & Negative Flow:**
    * [Skenario Gagal: Jika *payment gateway timeout*, tandai status 'Pending' dan berikan auto-retry 3x].
    * [Fallback: Jika sistem X mati, tampilkan pesan Y alih-alih layar *crash*].

---

## 4. External Integrations
List semua layanan pihak ketiga yang akan "berbicara" dengan sistem kita.
* **Authentication:** [Auth0 / Firebase / Custom JWT]
* **Payments:** [Stripe / Midtrans / Xendit]
* **Storage:** [AWS S3 / Google Cloud Storage]
* **Notifications:** [Twilio / SendGrid / Firebase Cloud Messaging]

---

## 5. Non-Functional Requirements (NFR)
Standar kualitas untuk menjaga *clean architecture*.
* **Performance:** [Misal: Max API response time 300ms].
* **Security:** [Misal: Data enkripsi AES-256, Audit logs untuk setiap mutasi data].
* **Scalability:** [Misal: Harus sanggup handle 5000 concurrent users].
* **Availability:** [Misal: Uptime 99.9%].
* **Data Compliance & Privacy:** [Misal: Sesuai UU PDP / GDPR untuk penanganan PII - *Personally Identifiable Information*].

---

## 6. Critical User Journeys (CUJ)
Tuliskan 3-5 alur utama agar AI paham bagaimana fitur-fitur ini saling terhubung.
1. **Journey 1 (Registration):** User Input -> Email Verification -> Profile Setup -> Success.
2. **Journey 2 (Transaction):** Browse -> Add to Cart -> Checkout -> Payment Webhook -> Order Confirmed.

---

## 7. Technical Constraints & Assumptions
* **Constraints:**
    * [Database: Harus PostgreSQL].
    * [Infrastructure: Harus Dockerized].
* **Assumptions:**
    * [Misal: User dianggap selalu memiliki koneksi internet stabil saat akses fitur X].

---

## 8. Handover & Coding Division Notes
* **Tech Stack Reference:** (Akan diisi pada Tahap 2: Tech Stack Selection).
* **Standardization:** (Akan diisi pada Tahap 3: The Rulebook).