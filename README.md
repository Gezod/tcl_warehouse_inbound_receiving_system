# Warehouse Inbound Receiving System (TCL)

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-6E9F18?logo=vitest)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.50-2EAD33?logo=playwright)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)

A high-reliability, concurrency-safe Warehouse Inbound Receiving System built with Next.js 14 App Router, TypeScript, pure PostgreSQL parameterized SQL (`pg`), Tailwind CSS, Vitest, Playwright, and Docker Compose.

---

## Daftar Isi (Table of Contents)

1. [Ikhtisar Sistem (System Overview)](#1-ikhtisar-sistem-system-overview)
2. [Fitur & Kemampuan Utama (Core Features)](#2-fitur--kemampuan-utama-core-features)
3. [Arsitektur & Diagram Sistem (System Architecture)](#3-arsitektur--diagram-sistem-system-architecture)
4. [Teknologi yang Digunakan (Technology Stack)](#4-teknologi-yang-digunakan-technology-stack)
5. [Struktur Direktori Proyek (Project Structure)](#5-struktur-direktori-proyek-project-structure)
6. [Prasyarat Sistem (Prerequisites)](#6-prasyarat-sistem-prerequisites)
7. [Konfigurasi Environment (.env)](#7-konfigurasi-environment-env)
8. [Panduan Menjalankan Aplikasi (Step-by-Step Guide)](#8-panduan-menjalankan-aplikasi-step-by-step-guide)
   - [Opsi A: Menggunakan Docker Compose (Production/Evaluasi)](#opsi-a-menggunakan-docker-compose-production--evaluasi)
   - [Opsi B: Menjalankan Secara Lokal (Development)](#opsi-b-menjalankan-secara-lokal-development)
9. [Akun & Kredensial Bawaan (Default Credentials)](#9-akun--kredensial-bawaan-default-credentials)
10. [Panduan Alur Kerja / Walkthrough Bisnis](#10-panduan-alur-kerja--walkthrough-bisnis)
11. [Daftar Perintah Lengkap (NPM Scripts Reference)](#11-daftar-perintah-lengkap-npm-scripts-reference)
12. [Pengujian & Verifikasi Kualitas (Testing & QA)](#12-pengujian--verifikasi-kualitas-testing--qa)
    - [Tingkatan Pengujian (Unit, Integration, Concurrency, E2E)](#tingkatan-pengujian)
    - [Jaminan Konkurensi & Idempotensi (Concurrency Guarantees)](#jaminan-konkurensi--idempotensi)
    - [Verifikator Konsistensi Data (NFR-01)](#verifikator-konsistensi-data-nfr-01)
    - [Skrip Otomasi Validasi Clean Clone](#skrip-otomasi-validasi-clean-clone)
13. [Spesifikasi Teknis & Dokumentasi Acuan](#13-spesifikasi-teknis--dokumentasi-acuan)
14. [Batasan Sistem & Roadmap (Known Limitations)](#14-batasan-sistem--roadmap-known-limitations)

---

## 1. Ikhtisar Sistem (System Overview)

Sistem Penerimaan Barang Gudang (**Warehouse Receiving System**) dirancang untuk mengelola dan memvalidasi seluruh siklus penerimaan barang fisik dari pemasok (*inbound logistics*). Sistem memastikan tidak terjadi selisih pencatatan antara barang yang dipesan dan barang fisik yang diterima, mencegah kelebihan penerimaan (*over-receipt*), menyediakan audit log yang tidak dapat diubah (*immutable*), dan menghitung saldo stok secara dinamis secara *real-time*.

### Masalah yang Diselesaikan:
- **Pencegahan Kelebihan Penerimaan (*Over-Receipt*)**: Menjamin secara mutlak bahwa jumlah barang fisik yang dicatat tidak dapat melebihi jumlah yang diekspektasikan pada baris dokumen penerimaan.
- **Keamanan Konkurensi Tinggi (*Race-Condition Safe*)**: Menggunakan teknik penguncian baris database hierarkis (`SELECT ... FOR UPDATE`) sehingga puluhan staf gudang yang memindai barang bersamaan tidak akan menyebabkan selisih data atau *deadlock*.
- **Ketahanan Jaringan & Idempotensi**: Menjamin bahwa transmisi ganda (*network retry*) atau klik ganda dari operator tidak akan menghasilkan mutasi stok ganda melalui *Idempotency Key* dan *caching replay* 24 jam.
- **Konsistensi Saldo Stok Mutlak (NFR-01)**: Stok fisik (*on-hand stock*) tidak disimpan sebagai angka statis yang rentan desinkronisasi, melainkan dihitung langsung dari seluruh transaksi mutasi penerimaan yang valid.

---

## 2. Fitur & Kemampuan Utama (Core Features)

### 1. Manajemen Katalog Produk
- Pembuatan dan pembaruan data produk (SKU, Nama Produk, Deskripsi, Satuan Dasar).
- Validasi SKU unik tanpa membedakan huruf besar/kecil (*case-insensitive* `BR-01`).
- Penguncian SKU otomatis (*SKU Locked* `FR-03`): SKU tidak dapat diubah lagi jika produk sudah pernah terdaftar pada dokumen penerimaan atau transaksi stok.
- Penonaktifan produk secara aman (*soft deactivation* `FR-04`): Produk nonaktif tidak dapat ditambahkan ke dokumen penerimaan baru (`BR-12`), namun riwayat transaksi masa lalu tetap utuh.

### 2. Dokumen Penerimaan Barang (*Receiving Documents & Lines*)
- Pembuatan dokumen penerimaan berstatus `DRAFT` dengan nomor dokumen otomatis sequential `RD-YYYY-NNNNNN` (`BR-15`).
- Validasi nomor referensi PO/SJ unik per pemasok (`BR-14`).
- Tambah, edit, dan hapus baris produk dalam status `DRAFT`.
- Edit kuantitas baris pada status `OPEN` dibatasi hanya untuk Supervisor dan tidak boleh kurang dari kuantitas yang sudah diterima.
- Pembatalan dokumen (`CANCELLED`) hanya diizinkan untuk dokumen yang belum memiliki riwayat penerimaan sama sekali (`BR-07`).

### 3. State Machine Siklus Hidup Dokumen
```
[DRAFT] ───(Submit with >= 1 line)───> [OPEN]
   │                                      │
(Cancel)                               (Cancel if 0 receipts)
   │                                      │
   ▼                                      ▼
[CANCELLED]                          [CANCELLED]

[OPEN] ───(Partial Receipt)───> [PARTIALLY_RECEIVED]
  │                                      │
(Full Receipt)                    (Remaining Receipt)
  │                                      │
  ▼                                      ▼
[PARTIALLY_RECEIVED]              [COMPLETED] (All remaining = 0)
```

### 4. Eksekusi Penerimaan Barang (*Receipts*) & Idempotensi
- Operator merekam penerimaan barang fisik secara parsial maupun penuh.
- Header `Idempotency-Key` (UUID v4) disertakan pada setiap mutasi penerimaan.
- Transaksi ACID atomik: Jika salah satu baris dalam batch melebihi sisa yang diharapkan, seluruh batch dibatalkan (*rollback*) dengan status HTTP `422 OVER_RECEIPT`.
- Database constraint `CHECK (received_qty <= expected_qty)` sebagai pertahanan lapis akhir.

### 5. Buku Besar Transaksi & Inventaris Dinamis
- Setiap barang yang diterima otomatis mencatat 1 baris mutasi `inventory_transactions` tipe `RECEIPT`.
- Tabel mutasi dan audit log dilindungi oleh trigger PostgreSQL: `UPDATE` dan `DELETE` dilarang keras (*append-only*).
- Halaman inventaris menampilkan stok *on-hand*, stok tersedia, dan waktu pergerakan terakhir secara instan.

### 6. Role-Based Access Control (RBAC) & Manajemen Pengguna
- **Operator**: Merekam penerimaan fisik, membuat/mengedit draf dokumen dan baris barang, melihat data katalog, stok, dan mutasi.
- **Supervisor**: Mengelola katalog produk, mengelola akun pengguna, mengubah catatan dokumen aktif, membatalkan dokumen tanpa tanda terima, dan menyelesaikan dokumen penerimaan.
- **Proteksi Supervisor Terakhir (D-08)**: Sistem menolak penonaktifan atau penurunan role (*demotion*) supervisor terakhir yang masih aktif dengan HTTP `409 LAST_SUPERVISOR_ACTION_FORBIDDEN`.

---

## 3. Arsitektur & Diagram Sistem (System Architecture)

### Diagram Alur Data & Komponen

```mermaid
graph TD
    User["Web Browser / Client"] -->|HTTPS + Session Cookie| NextServer["Next.js 14 App Router"]
    
    subgraph "Application Layer"
        NextServer --> Middleware["Auth Guard & CSRF Origin Check"]
        Middleware --> RouteHandlers["API Route Handlers (/api/*)"]
        RouteHandlers --> Services["Domain Services"]
        Services --> Validation["Zod Schema Validation"]
    end

    subgraph "Data Access Layer"
        Services --> Tx["withTransaction Isolation"]
        Tx --> Repositories["Repositories (Parameterized SQL)"]
        Repositories --> Pool["node-postgres Connection Pool (max: 25)"]
    end

    subgraph "Database Layer (PostgreSQL 16)"
        Pool --> Docs["receiving_documents"]
        Pool --> Lines["receiving_lines (CHECK received <= expected)"]
        Pool --> Receipts["receipts (Unique batch_id)"]
        Pool --> TxLog["inventory_transactions (Append-Only Trigger)"]
        Pool --> Idemp["idempotency_keys (24h TTL Replay)"]
        Pool --> Users["users & user_sessions"]
        Pool --> Audit["audit_logs (Append-Only Trigger)"]
    end
```

### Urutan Penguncian Konkurensi (*Locking Hierarchy*)
Untuk mencegah terjadinya kebuntuan (*deadlock*) pada saat banyak staf gudang memproses penerimaan secara bersamaan, transaksi menggunakan urutan penguncian deterministik:
1. `SELECT ... FROM receiving_documents WHERE id = $1 FOR UPDATE`
2. `SELECT ... FROM receiving_lines WHERE id = ANY($1) ORDER BY id ASC FOR UPDATE`

---

## 4. Teknologi yang Digunakan (Technology Stack)

| Kategori | Teknologi | Versi | Alasan Penggunaan |
|---|---|---|---|
| **Core Framework** | Next.js (App Router) | 14.2.35 | Server Components, Route Handlers bawaan, optimasi rute otomatis. |
| **Bahasa Pemrograman** | TypeScript | 5.7+ | Tipe data kuat (*strict mode*) dari schema Zod hingga database return types. |
| **Database Engine** | PostgreSQL | 16 | ACID transactions, row-level locks, CHECK constraints, trigger function. |
| **Database Driver** | node-postgres (`pg`) | 8.13.1 | Akses SQL langsung terparameterisasi tanpa overhead abstraksi ORM. |
| **Database Migrations** | node-pg-migrate | 7.9.1 | Manajemen skema DDL berulang (*up/down*) berbasis forward SQL murni. |
| **Styling & UI Tokens** | Tailwind CSS + Lucide React | 3.4 / 0.475 | Utility-first CSS, custom semantic tokens, iconography modern. |
| **Autentikasi & Enkripsi** | bcryptjs | 2.4.3 | Hashing password dengan cost factor 12, aman terhadap *timing attacks*. |
| **Pengujian Unit & Integrasi** | Vitest | 3.0.5 | Runner test cepat, kompatibel dengan ESM, mendukung konkurensi database riil. |
| **Pengujian End-to-End** | Playwright | 1.50.1 | Pengujian otomatis alur browser Chromium multi-role secara komprehensif. |
| **Containerization** | Docker & Docker Compose | Multi-Stage | Standarisasi deployment lingkungan produksi yang ringan dan aman. |

---

## 5. Struktur Direktori Proyek (Project Structure)

```
TCL/
├── .env.example                                  # Template variabel lingkungan
├── Dockerfile                                    # Multi-stage production container
├── docker-compose.yml                            # Orkestrasi container db, migrate, app, seed
├── next.config.mjs                               # Konfigurasi Next.js & HTTP Security Headers
├── package.json                                  # Manifest dependensi & script proyek
├── playwright.config.ts                          # Konfigurasi Playwright E2E browser runner
├── README.md                                     # Dokumentasi panduan operasional proyek
├── tsconfig.json                                 # Konfigurasi compiler TypeScript
├── app/                                          # Next.js App Router (Halaman & REST API)
│   ├── layout.tsx                                # Root Layout HTML & Typography Inter
│   ├── (auth)/login/page.tsx                     # Halaman Login
│   ├── (app)/                                    # Protected Application Shell
│   │   ├── layout.tsx                            # Responsive Sidebar, Drawer, Profile & Logout
│   │   ├── page.tsx                              # Dashboard Operasional & Kartu Metrik
│   │   ├── products/page.tsx                     # Halaman Katalog Produk
│   │   ├── receiving-documents/
│   │   │   ├── page.tsx                          # Daftar Dokumen Penerimaan
│   │   │   ├── new/page.tsx                      # Form Pembuatan Dokumen Baru
│   │   │   └── [id]/page.tsx                     # Rincian Dokumen, Baris & Riwayat Penerimaan
│   │   ├── inventory/page.tsx                    # Halaman Stok Fisik On-Hand
│   │   ├── transactions/page.tsx                 # Halaman Buku Besar Mutasi Stok
│   │   └── users/page.tsx                        # Halaman Manajemen Pengguna (Supervisor)
│   └── api/                                      # Backend REST API Handlers
│       ├── auth/ (login, logout, me)             # Autentikasi sesi
│       ├── health/ (live, ready)                 # Health probes untuk container orchestration
│       ├── products/ ([productId], deactivate)   # CRUD & status produk
│       ├── receiving-documents/                  # Dokumen, lines, submit, complete, cancel
│       ├── inventory/                            # Query saldo stok dinamis
│       ├── transactions/                         # Query mutasi stok
│       └── users/ ([userId])                     # Manajemen user & role
├── components/                                   # Komponen Antarmuka Reusable
│   ├── ui/ (status-badge, sheet, toast)          # Primitif UI & Desain Tokens
│   ├── products/ (product-table, product-sheet)  # Komponen katalog produk
│   ├── receiving/                                # Dialog penerimaan, tabel baris, kartu header
│   └── users/ (user-sheet)                       # Panel geser manajemen user
├── docs/                                         # Spesifikasi & Dokumentasi Standar
│   ├── prd.md                                    # Product Requirements Document (PRD v1.1)
│   ├── technical-spec.md                         # Technical Specification (v1.0)
│   ├── openapi.yaml                              # Kontrak OpenAPI 3.0.3 lengkap
│   ├── erd.mmd                                   # Entity Relationship Diagram (Mermaid)
│   ├── design.md                                 # Panduan Desain & Token UI
│   ├── testing.md                                # Strategi Pengujian, RTM & Bukti Konkurensi
│   └── ai-workflow.md                            # Log audit 10 fase pengembangan AI
├── migrations/                                   # 10 Skrip SQL migrasi database forward
├── scripts/                                      # Skrip CLI Operasional
│   ├── migrate.ts                                # Eksekutor migrasi database
│   ├── seed.ts                                   # Seeder akun awal Operator & Supervisor
│   ├── verify-consistency.ts                     # Verifikator Invariant SQL otomatis (npm run verify)
│   ├── test-clean-clone.ps1                      # Skrip validasi clean clone (PowerShell)
│   └── test-clean-clone.sh                       # Skrip validasi clean clone (Bash)
├── src/                                          # Kode Sumber Logika Backend & Domain
│   ├── lib/ (api-client, utils, zod schemas)     # Validasi skema & helper fetch klien
│   ├── server/                                   # Backend Domain Core
│   │   ├── auth/ (cookies, guard, sessions)      # Logika sesi & proteksi CSRF
│   │   ├── config/ (env parsing)                 # Validasi variabel lingkungan dengan Zod
│   │   ├── db/ (pool, tx helper)                 # Node-postgres connection pool & transaksi
│   │   ├── domain/ (lifecycle state machine)     # Mesin status siklus hidup dokumen
│   │   ├── repositories/                         # Lapisan kueri SQL terparameterisasi
│   │   └── services/                             # Lapisan aturan bisnis & transaksi ACID
│   └── types/ (domain.ts)                        # Kontrak tipe data TypeScript
└── tests/                                        # Seluruh Rangkaian Pengujian Otomatis
    ├── unit/                                     # 47 Unit Tests (pure functions & schema)
    ├── integration/                              # 43 Integration Tests (PostgreSQL riil)
    ├── concurrency/                              # 2 Concurrency Tests (20 koneksi paralel)
    └── e2e/                                      # 1 Playwright E2E Test (Alur browser lengkap)
```

---

## 6. Prasyarat Sistem (Prerequisites)

Sebelum menjalankan aplikasi, pastikan perangkat Anda memiliki:

- **Node.js**: Versi `20.x` LTS atau `22.x` LTS
- **npm**: Versi `10.x` atau lebih baru
- **Docker & Docker Compose**: Docker Desktop (Windows/macOS) atau Docker Engine + Docker Compose v2 (Linux)
- **Port Tersedia**:
  - Port `3000` (untuk Web Application)
  - Port `5433` (untuk koneksi host ke database PostgreSQL container)

---

## 7. Konfigurasi Environment (.env)

Buat file `.env` dengan menyalin template `.env.example`:

```bash
cp .env.example .env
```

Berikut adalah tabel rincian variabel konfigurasi:

| Variabel | Tipe Data | Nilai Bawaan (.env.example) | Deskripsi |
|---|---|---|---|
| `NODE_ENV` | Enum | `development` | Mode lingkungan (`development`, `production`, `test`). |
| `PORT` | Number | `3000` | Port listening server Next.js. |
| `DATABASE_URL` | String | `postgres://app:change-me@localhost:5433/warehouse` | URL koneksi PostgreSQL utama untuk aplikasi. |
| `TEST_DATABASE_URL` | String | `postgres://app:change-me@localhost:5433/warehouse_test` | URL koneksi database isolasi khusus pengujian. |
| `POSTGRES_PORT` | Number | `5433` | Port eksternal PostgreSQL pada Docker host. |
| `APP_TIMEZONE` | String | `Asia/Jakarta` | Zona waktu acuan format tanggal dan nomor dokumen. |
| `SESSION_TTL_HOURS` | Number | `8` | Masa berlaku sesi login pengguna dalam jam. |
| `SEED_OPERATOR_USERNAME` | String | `operator` | Username seed untuk peran Operator. |
| `SEED_OPERATOR_PASSWORD` | String | `OperatorPass123!` | Password awal akun Operator. |
| `SEED_SUPERVISOR_USERNAME` | String | `supervisor` | Username seed untuk peran Supervisor. |
| `SEED_SUPERVISOR_PASSWORD` | String | `SupervisorPass123!` | Password awal akun Supervisor. |
| `LOG_LEVEL` | Enum | `info` | Tingkat rincian log sistem (`debug`, `info`, `warn`, `error`). |
| `POSTGRES_USER` | String | `app` | Username admin PostgreSQL di container Docker. |
| `POSTGRES_PASSWORD` | String | `change-me` | Password PostgreSQL di container Docker. |
| `POSTGRES_DB` | String | `warehouse` | Nama database awal di container Docker. |

---

## 8. Panduan Menjalankan Aplikasi (Step-by-Step Guide)

### Opsi A: Menggunakan Docker Compose (Production / Evaluasi)

Cara termudah dan paling terisolasi untuk menjalankan seluruh ekosistem aplikasi tanpa perlu menginstal dependensi Node.js secara lokal.

1. **Salin Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Jalankan Seluruh Layanan dengan Docker Compose**:
   ```bash
   docker compose up --build -d
   ```
   *Layanan database (`db`) akan aktif lebih dulu, diikuti eksekusi migrasi otomatis (`migrate`), dan server Next.js (`app`) akan otomatis menyala setelah migrasi selesai.*

3. **Jalankan Seeder Akun Awal**:
   ```bash
   docker compose --profile seed run --rm seed
   ```

4. **Verifikasi Kesiapan Sistem**:
   ```bash
   curl -f http://localhost:3000/api/health/ready
   ```
   *Respons yang diharapkan:*
   ```json
   {"status":"ok","database":"up","migrations":"up_to_date"}
   ```

5. **Akses Aplikasi**:
   Buka browser di **[http://localhost:3000](http://localhost:3000)**.

---

### Opsi B: Menjalankan Secara Lokal (Development)

Digunakan untuk pengembangan aktif dan *live code reloading*.

1. **Instal Dependensi**:
   ```bash
   npm ci
   ```

2. **Salin File Environment**:
   ```bash
   cp .env.example .env
   ```

3. **Jalankan Database PostgreSQL via Docker**:
   ```bash
   docker compose up -d db
   ```

4. **Eksekusi Migrasi Database**:
   ```bash
   npm run db:migrate
   ```

5. **Jalankan Seeding Akun Bawaan**:
   ```bash
   npm run db:seed
   ```

6. **Mulai Server Development Next.js**:
   ```bash
   npm run dev
   ```

7. **Buka Aplikasi**:
   Buka browser di **[http://localhost:3000](http://localhost:3000)**.

---

## 9. Akun & Kredensial Bawaan (Default Credentials)

Setelah proses `seed` dijalankan, gunakan akun berikut untuk masuk ke sistem:

| Peran | Username | Password | Otoritas & Akses Modul |
|---|---|---|---|
| **Supervisor** | `supervisor` | `SupervisorPass123!` | **Akses Penuh**: Manajemen Pengguna (`/users`), Tambah/Edit Produk (`/products`), Selesaikan Dokumen (`Complete`), Batalkan Dokumen (`Cancel`), Ubah Catatan Dokumen. |
| **Operator** | `operator` | `OperatorPass123!` | **Akses Terbatas**: Rekam Penerimaan Fisik (`Record Receipts`), Buat/Edit Dokumen DRAFT, Tambah Baris Barang DRAFT, Lihat Stok Inventaris, Lihat Mutasi. |

---

## 10. Panduan Alur Kerja / Walkthrough Bisnis

Berikut adalah langkah-langkah uji coba alur operasional standar dari awal hingga selesai:

### Skenario: Penerimaan Komponen Elektronik Baru

1. **Login sebagai Supervisor**:
   - Buka `http://localhost:3000/login`.
   - Masukkan username `supervisor` dan password `SupervisorPass123!`.
   - Anda akan diarahkan ke **Dashboard** dengan ringkasan metrik gudang.

2. **Pendaftaran Produk Baru di Katalog**:
   - Buka menu **Products** di navigasi sidebar.
   - Klik tombol **New Product** di pojok kanan atas.
   - Masukkan SKU: `CAP-100UF-50V`, Nama: `Electrolytic Capacitor 100uF 50V`, Base Unit: `pcs`.
   - Klik **Create Product**. Produk akan muncul aktif dalam tabel.

3. **Pendaftaran Dokumen Pengiriman (DRAFT)**:
   - Buka menu **Receiving Documents**, klik **New Document**.
   - Masukkan Supplier: `PT Jaya Semikonduktor`, PO Number: `PO-2026-9901`, Tanggal Ekspektasi Tiba, dan Catatan Dock.
   - Klik **Create Receiving Document**. Dokumen dibuat dalam status `DRAFT` dengan nomor sequential (misal: `RD-2026-000001`).

4. **Menambahkan Rencana Barang & Mengirim Dokumen**:
   - Di halaman rincian dokumen, klik **Add Line**.
   - Pilih produk `CAP-100UF-50V` dan masukkan kuantitas ekspektasi: `100`.
   - Klik **Add Line**. Baris produk akan tercatat dengan Expected: `100`, Received: `0`, Remaining: `100`.
   - Klik tombol **Submit Document** di bagian atas (konfirmasi pop-up browser).
   - Status dokumen resmi berubah dari `DRAFT` menjadi `OPEN`.

5. **Login sebagai Operator untuk Penerimaan Barang Fisik**:
   - Klik **Sign out** di navigasi bawah.
   - Login dengan username `operator` dan password `OperatorPass123!`.
   - Buka dokumen `RD-2026-000001` yang berstatus `OPEN`.
   - Klik tombol **Record Receipts**.
   - Masukkan kuantitas penerimaan parsial: `40` unit dengan catatan `Pallet 1 - Kondisi Baik`.
   - Klik **Confirm Receipts**.
   - Dokumen otomatis bertransisi menjadi `PARTIALLY_RECEIVED` (Received: 40, Remaining: 60).

6. **Verifikasi Stok & Mutasi Real-Time**:
   - Buka menu **Inventory**: Cari SKU `CAP-100UF-50V`, stok *on-hand* otomatis tercatat bertambah menjadi `40 pcs`.
   - Buka menu **Transactions**: Tertera 1 baris mutasi tipe `RECEIPT` sejumlah `+40 pcs` dengan referensi nomor dokumen yang bersangkutan.

7. **Penyelesaian Dokumen oleh Supervisor**:
   - Logout dan masuk kembali sebagai `supervisor`.
   - Buka kembali dokumen tersebut, klik **Record Receipts** $\rightarrow$ klik **Receive All Remaining** (otomatis terisi 60) $\rightarrow$ klik **Confirm Receipts**.
   - Total penerimaan sekarang telah mencapai 100% (Received: 100, Remaining: 0).
   - Klik tombol **Complete Document**. Dokumen bertransisi ke status terminal `COMPLETED`.
   - Tombol transaksi otomatis terkunci untuk menjamin integritas data masa lalu.

---

## 11. Daftar Perintah Lengkap (NPM Scripts Reference)

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan Next.js development server di port 3000 dengan Hot-Module-Replacement (HMR). |
| `npm run build` | Melakukan kompilasi produksi yang teroptimasi, validasi types, dan linting. |
| `npm start` | Menjalankan server Next.js mode produksi dari hasil build folder `.next`. |
| `npm run lint` | Menjalankan ESLint untuk memeriksa standar penulisan kode dan aturan App Router. |
| `npm test` | Menjalankan seluruh 90 unit tests, integration tests, dan concurrency tests via Vitest. |
| `npm run test:unit` | Menjalankan kelompok unit test (lifecycle, schema validation, auth guards, rules). |
| `npm run test:integration` | Menjalankan kelompok integration test terhadap database PostgreSQL nyata. |
| `npm run test:concurrency` | Menjalankan pengujian balapan konkurensi (20 koneksi paralel & idempotency lock). |
| `npm run test:e2e` | Menjalankan pengujian otomatis end-to-end berbasis browser Chromium via Playwright. |
| `npm run verify` | Menjalankan skrip verifikator invariant integritas data SQL (NFR-01 stock match). |
| `npm run db:migrate` | Menjalankan seluruh migrasi DDL forward yang belum diaplikasikan. |
| `npm run db:migrate:down` | Membatalkan migrasi database satu tingkat ke belakang (*rollback*). |
| `npm run db:seed` | Mengisi data pengguna awal (`supervisor` dan `operator`) ke database. |

---

## 12. Pengujian & Verifikasi Kualitas (Testing & QA)

Sistem ini menerapkan standar pengujian berlapis yang terdokumentasi lengkap pada [docs/testing.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/testing.md).

### Tingkatan Pengujian

1. **Unit Tests (`tests/unit/`)**:
   - Memvalidasi state machine siklus hidup dokumen (16 kasus transisi).
   - Memvalidasi aturan kuantitas positif, hashing canonical JSON, normalisasi SKU, dan aturan hak akses.
2. **Integration Tests (`tests/integration/`)**:
   - Berjalan langsung terhadap instance PostgreSQL riil tanpa *mocking* database.
   - Menguji transaksi rollback, constraint unik, status HTTP (400, 401, 403, 404, 409, 422), dan filter data.
3. **Concurrency Tests (`tests/concurrency/`)**:
   - Diuji menggunakan *pool* koneksi database $\ge 20$ koneksi simultan.
4. **End-to-End Tests (`tests/e2e/`)**:
   - Menjalankan browser Chromium headless otomatis untuk memverifikasi alur UI dan pergantian sesi pengguna.

### Jaminan Konkurensi & Idempotensi
- **Uji 20 Permintaan Simultan**:
  - Dokumen status `OPEN` dengan baris ekspektasi 10 unit ditembak 20 request paralel serentak (`Promise.all`).
  - **Hasil**: Tepat **10 request berhasil** (`201 Created`), tepat **10 request ditolak** (`422 OVER_RECEIPT`). Kuantitas akhir tepat 10, dan tepat 10 mutasi tercatat tanpa *race condition*.
- **Uji 10 Idempotency Key Identik**:
  - 10 request dikirim paralel dengan kunci yang sama persis.
  - **Hasil**: Semua request menerima HTTP 200/201 replay, dan hanya terjadi **1 kali penulisan database**.

### Verifikator Konsistensi Data (NFR-01)
Jalankan verifikasi invariant kapan saja menggunakan:
```bash
npm run verify
```
Skrip ini mengeksekusi 3 pemeriksaan SQL mendalam:
1. Menghitung selisih antara stok produk saat ini dengan akumulasi mutasi transaksi penerimaan (harus 0).
2. Menghitung selisih antara `line.received_qty` dengan akumulasi penerimaan fisik (harus 0).
3. Memastikan tidak ada dokumen `DRAFT`/`CANCELLED` yang memiliki tanda terima, dan dokumen `COMPLETED` memiliki sisa 0.

### Skrip Otomasi Validasi Clean Clone
Untuk menguji bahwa sistem dapat dibangun dari *fresh repository clone* tanpa kegagalan:
- **Windows (PowerShell)**:
  ```powershell
  .\scripts\test-clean-clone.ps1
  ```
- **Linux/macOS (Bash)**:
  ```bash
  chmod +x ./scripts/test-clean-clone.sh
  ./scripts/test-clean-clone.sh
  ```

---

## 13. Spesifikasi Teknis & Dokumentasi Acuan

Seluruh arsitektur dibangun dengan mematuhi spesifikasi dokumen acuan di folder `docs/`:

- [docs/prd.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/prd.md) — Dokumen Kebutuhan Produk (PRD v1.1)
- [docs/technical-spec.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/technical-spec.md) — Spesifikasi Teknis, Invariant & Desain API (v1.0)
- [docs/openapi.yaml](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/openapi.yaml) — Kontrak REST API Standar OpenAPI 3.0.3
- [docs/erd.mmd](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/erd.mmd) — Diagram Struktur Relasi Entitas Database (Mermaid)
- [docs/design.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/design.md) — Token Desain Antarmuka, Layout Sidebar & Komponen UI
- [docs/testing.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/testing.md) — Matriks Ketertelusuran Kebutuhan (RTM), Bukti Uji & Audit Dependensi
- [docs/ai-workflow.md](file:///c:/Users/Refangga%20Lintar/Documents/TCL/docs/ai-workflow.md) — Catatan Alur Kerja & Log Audit Pengembangan 10 Fase

---

## 14. Batasan Sistem & Roadmap (Known Limitations)

Sesuai dengan kesepakatan cakupan rilis versi 1.0 pada Technical Specification (Section 15):

1. **Single Warehouse / Global Stock**: Seluruh pergerakan barang dicatat pada tingkat gudang global, belum membedakan rak spesifik (*aisle/bin location*).
2. **Serial & Lot Tracking**: Pelacakan menggunakan kuantitas bilangan bulat (*integer*) pada satuan dasar produk; pelacakan nomor seri unik individual (*serial number*) dan tanggal kedaluwarsa lot bahan baku belum disertakan.
3. **Rate Limiting Login**: Proteksi *brute-force* pada endpoint login disarankan ditangani oleh lapisan *reverse proxy* (Nginx/Cloudflare) pada lingkungan produksi publik.
4. **Konektivitas Database**: Aplikasi web memerlukan koneksi jaringan aktif ke kluster PostgreSQL dan belum mendukung pencatatan luring (*offline sync*).

### Rekomendasi Pengembangan Masa Depan (v2)
- Integrasi pemindai barcode kamera langsung melalui WebRTC pada perangkat genggam (*handheld barcode scanner*).
- Penambahan kolom multi-gudang (`warehouse_id`) pada dokumen penerimaan dan transaksi inventaris.
- Pembuatan laporan rekapitulasi penerimaan barang berkala dalam format PDF/Excel.

---

## 15. Lisensi & Hak Cipta

**Warehouse Inbound Receiving System (TCL)**  
Hak Cipta Dilindungi Undang-Undang — *Private & Proprietary Software*.
