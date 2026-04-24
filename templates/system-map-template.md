# System Map — `.ceobe/system-map.md`
**Project Name:** [Nama Proyek]  
**Generated:** [ISO_DATE]  
**Entry Type:** Brownfield

---

## 1. Project Summary
- **Tujuan aplikasi:** [1-2 kalimat tujuan utama]
- **Tech stack utama:** [Runtime, Framework, Database]
- **Pola arsitektur:** [Monolith / Microservices]

---

## 2. Core Logic Flow (Function-Level)
Trace alur kritikal utama sistem:
`[Route/Trigger] → [Controller] → [Service] → [Repository] → [DB/API]`

### Flow 1: [Nama Flow]
```
POST /auth/register → authRoutes → authService.register() → userRepository.create() → DB:users
```

---

## 3. Clean Tree (Source Code Only)
[Pohon direktori yang difilter dari node_modules, build, dll]

---

## 4. Module Map (The Chapters)
### `src/index.ts`
- **Functions:** [list functions]
- **Role:** [peran]

---

## 5. Data & Config
| Table | Kolom Inti | Relasi |
|-------|-----------|--------|
| [table_name] | [kolom penting] | [FK → table lain] |

---

## 6. External Integrations
| Service/API | Tujuan | Modul Pemanggil |
|-------------|--------|-----------------|
| [e.g., Stripe] | [Payment] | `src/payment.ts` |

---

## 7. Risks / Blind Spots
- [ ] [Area yang tidak bisa dipetakan pasti]
