---
name: bdd-testing
description: Mengajarkan Ceobe untuk generate dan menjalankan Gherkin scenarios (BDD) dari BRD acceptance criteria.
---

# BDD Testing & Traceability Skill

Skill ini berfokus pada pendekatan Behavior-Driven Development (BDD). Ceobe akan menggunakan skill ini untuk menulis *executable specifications* dalam format Gherkin (`.feature` files) berdasarkan *Acceptance Criteria* yang didefinisikan pada Business Requirements Document (BRD).

## 1. Analisis Requirement (Traceability)
Setiap skenario tes wajib memiliki referensi balik (traceability) ke dokumen spesifikasi (BRD/Architecture).

- Baca `brd.md` (terutama bagian Acceptance Criteria).
- Baca `.ceobe/architecture.md` (terutama bagian ADR) untuk memahami batasan sistem.
- Di dalam setiap `.feature` file, tambahkan komentar header yang menunjuk ke bagian spesifik pada BRD.

Contoh:
```gherkin
# Traceability: BRD §3.1 (User Authentication) -> Acceptance Criteria #2
Feature: User Login
  As a registered user
  I want to log in using my credentials
  So that I can access my dashboard
```

## 2. Penulisan Skenario BDD (Gherkin)
Gunakan format standar Given/When/Then. Pastikan penulisan jelas, tidak ambigu, dan berorientasi pada perilaku *user* (bukan implementasi teknis).

```gherkin
  Scenario: Successful login with valid credentials
    Given the user is on the login page
    And the user has a registered account with email "user@example.com" and password "Password123!"
    When the user enters "user@example.com" in the email field
    And the user enters "Password123!" in the password field
    And the user clicks the "Login" button
    Then the system should redirect the user to the dashboard
    And the user should see a welcome message "Welcome back!"
```

## 3. Implementasi Step Definitions
Setelah membuat `.feature` files, sistem akan meminta pembuatan *step definitions* (baik menggunakan Cucumber.js, Vitest, atau Jest-Cucumber).
- Pastikan setiap blok `Given/When/Then` di-map ke dalam testing framework yang dipakai proyek.
- Jika proyek belum memiliki konfigurasi BDD, sarankan setup awal untuk framework BDD yang sesuai dengan stack teknologi (contoh: `@cucumber/cucumber` untuk Node.js).

## 4. BDD sebagai Lapis Verifikasi Tambahan
Saat Supervisor menjalankan *Post-Execution Verification Loop*, BDD tests (jika ada) akan berjalan berdampingan dengan Unit Tests. Kegagalan pada BDD test menandakan bahwa kode belum memenuhi *Acceptance Criteria* bisnis, yang mana harus ditangkap dan diteruskan ke sistem *Self-Healing* Ceobe.
