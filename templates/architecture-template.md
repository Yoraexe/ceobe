# System Architecture Documentation
**Project Name:** [Nama Sistem]
**Architecture Style:** [e.g., Microservices / Monolithic / Event-Driven]

---

## 1. Overview & Architectural Pattern
* **High-Level Summary:** Gambaran umum bagaimana sistem bekerja secara holistik.
* **Core Pattern:** [e.g., Clean Architecture / Hexagonal / Layered]. Jelaskan alasan pemilihan pola ini untuk menghindari *technical debt*.

---

## 2. Technology Stack & Environment
| Layer | Technology | Version |
| :--- | :--- | :--- |
| **Frontend** | [React / Next.js / etc] | [Ver] |
| **Backend** | [Go / Node.js / Python] | [Ver] |
| **Database** | [PostgreSQL / MongoDB] | [Ver] |
| **Cache/Queue** | [Redis / RabbitMQ] | [Ver] |
| **Infrastructure** | [Docker / K8s / AWS] | [-] |

---

## 3. System Components & Responsibility
Detailkan peran setiap modul agar tidak terjadi *overlapping* tanggung jawab (SRP).
* **Component A (e.g., Auth Service):** Mengelola session dan JWT.
* **Component B (e.g., Worker Node):** Memproses *background jobs* secara asinkron.

---

## 4. Communication & Data Flow
* **API Strategy:** [RESTful / GraphQL / gRPC].
* **Flow Diagram:** * [User] -> [Load Balancer] -> [API Gateway] -> [Service] -> [Database].
* **Event Flow:** Jelaskan jika ada *Pub/Sub mechanism*.

---

## 5. Persistence & Storage Strategy
* **Primary DB:** Skema dan alasan penggunaan.
* **Caching Layer:** Strategi *in-memory data* (misal: Redis untuk session).
* **File Storage:** Penanganan asset (misal: Local storage via Docker volume atau S3).
* **Data Retention & Archiving:** Kebijakan pembersihan/pengarsipan data (contoh: *Soft delete* setelah 1 tahun dipindah ke *cold storage* DB untuk mencegah bloating).

---

## 6. Security & Compliance Strategy
* **Authentication:** [JWT / OAuth2 / Session-based].
* **Authorization:** [RBAC / ABAC].
* **Data Protection:** Strategi enkripsi *at rest* dan *in transit*.

---

## 7. Infrastructure & Observability (DevOps)
* **Deployment:** [Docker Compose / Helm Charts].
* **CI/CD Pipeline:** [GitHub Actions / Jenkins].
* **Monitoring:** [Prometheus / Sentry / CloudWatch].
* **Logging & Tracing:** Implementasi `X-Request-ID` / *Correlation ID* lintas layanan terdistribusi. Wajib menggunakan format JSON (misal JSON Log via Elasticsearch/Datadog).

---

## 8. Key Design Decisions (ADR)
Setiap keputusan arsitektural signifikan WAJIB direkam dalam format berikut:

### ADR-001: [Judul Keputusan]
- **Status:** Accepted | Superseded | Deprecated
- **Context:** Mengapa keputusan ini perlu diambil? Apa masalah yang dihadapi?
- **Decision:** Apa yang diputuskan?
- **Consequences:** Trade-off apa yang diterima?
- **Enforcement:** Bagaimana keputusan ini diverifikasi? (linting rule, test, CI check)

### ADR-002: [Judul Keputusan]
...