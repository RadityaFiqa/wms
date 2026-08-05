# 1. Pendahuluan

## 1.1 Latar Belakang

Proses pembuatan dokumen administrasi pada aplikasi saat ini masih dilakukan secara manual menggunakan aplikasi pengolah kata seperti Microsoft Word. Pengguna harus membuka template, mengubah isi dokumen secara manual, melakukan penyesuaian tata letak apabila diperlukan, kemudian menyimpan dokumen dalam format Word maupun PDF sebelum didistribusikan.

Pendekatan tersebut memiliki beberapa keterbatasan, antara lain:

* Membutuhkan waktu yang relatif lama untuk setiap dokumen.
* Berpotensi menyebabkan kesalahan pengisian data (human error).
* Format dokumen menjadi tidak konsisten antar pengguna.
* Sulit melakukan perubahan template secara terpusat.
* Tidak tersedia riwayat dokumen yang terintegrasi dengan aplikasi.
* Tidak terdapat mekanisme standar untuk penyimpanan dokumen hasil generate.

Seiring berkembangnya kebutuhan bisnis, jumlah template dokumen yang digunakan semakin banyak, seperti:

* Surat Penagihan
* Invoice
* Memo
* Berita Acara
* Surat Tugas
* Surat Jalan
* Kuitansi
* Dokumen Administrasi lainnya

Setiap jenis dokumen memiliki struktur yang berbeda namun proses pembuatannya memiliki pola yang sama, yaitu mengganti placeholder pada template dengan data aktual.

Untuk mengatasi permasalahan tersebut diperlukan sebuah modul **Document Template Management & Document Generator** yang mampu mengelola template dokumen secara terpusat, menghasilkan dokumen secara otomatis berdasarkan template, serta menyimpan seluruh hasil generate pada Object Storage.

---

# 1.2 Tujuan

Pengembangan modul ini bertujuan untuk:

* Menyediakan sistem pengelolaan template dokumen yang terpusat.
* Mengurangi proses manual dalam pembuatan dokumen.
* Menjamin konsistensi format seluruh dokumen.
* Menghasilkan dokumen Microsoft Word (.docx) secara otomatis berdasarkan template.
* Menghasilkan dokumen PDF dengan tata letak yang konsisten.
* Menyimpan seluruh dokumen pada MinIO Object Storage.
* Menyimpan metadata dokumen pada database sehingga dapat dilakukan pencarian, audit, dan pengelolaan riwayat dokumen.
* Menyediakan fondasi yang dapat dikembangkan untuk kebutuhan Digital Signature dan Document Management di masa mendatang.

---

# 1.3 Tujuan Bisnis

Implementasi modul ini diharapkan memberikan manfaat sebagai berikut:

* Mengurangi waktu pembuatan dokumen administrasi.
* Mengurangi kesalahan pengisian dokumen.
* Meningkatkan konsistensi format dokumen perusahaan.
* Mempermudah pengelolaan template tanpa perubahan kode aplikasi.
* Mempermudah distribusi dokumen melalui integrasi dengan sistem lain.
* Menjadi repository terpusat seluruh dokumen yang dihasilkan aplikasi.

---

# 1.4 Scope

## In Scope

Modul ini mencakup fitur-fitur berikut:

### Template Management

* Membuat template baru.
* Mengunggah template Microsoft Word (.docx).
* Mengubah informasi template.
* Menghapus template.
* Mengaktifkan atau menonaktifkan template.
* Versioning template.
* Preview template.
* Penyimpanan template pada MinIO.

### Placeholder Management

* Auto Detect Placeholder dari template DOCX menggunakan Docxtemplater.
* Penyimpanan metadata placeholder dalam `PLACEHOLDER_SCHEMA (JSONB)`.
* Validasi placeholder wajib.
* Dukungan berbagai tipe placeholder.

### Dynamic Form Generator

* Membangun form input secara otomatis berdasarkan `PLACEHOLDER_SCHEMA`.
* Menampilkan komponen input sesuai tipe data.
* Mendukung nilai default.
* Validasi data sebelum proses generate.

### Document Generation

* Generate dokumen Microsoft Word (.docx).
* Generate PDF menggunakan LibreOffice Headless.
* Penyimpanan DOCX dan PDF pada MinIO.
* Penyimpanan metadata dokumen pada tabel `DOCUMENT_GENERATED`.
* Preview dokumen.
* Download DOCX.
* Download PDF.

### Document Repository

* Riwayat dokumen yang telah dihasilkan.
* Pencarian dokumen.
* Filter berdasarkan template.
* Filter berdasarkan kategori.
* Filter berdasarkan tanggal.
* Soft Delete dokumen.

### Storage

* Penyimpanan file menggunakan MinIO Object Storage.
* Object Key Management.
* Presigned URL untuk proses download.
* Validasi integritas file menggunakan hash.

---

## Out of Scope

Fitur berikut tidak termasuk dalam ruang lingkup pengembangan tahap ini:

* Online Word Editor.
* Collaborative Document Editing.
* Digital Signature.
* Workflow Approval.
* OCR (Optical Character Recognition).
* AI Document Generation.
* Email Gateway.
* WhatsApp Gateway.
* Batch Generate ribuan dokumen.
* Template Builder berbasis web.

Fitur-fitur tersebut dapat dipertimbangkan pada fase pengembangan berikutnya.

---

# 1.5 Target Pengguna

Modul ini dirancang untuk digunakan oleh pengguna aplikasi internal yang membutuhkan proses pembuatan dokumen secara cepat dan konsisten.

Sistem tidak membatasi jenis dokumen tertentu sehingga dapat digunakan oleh berbagai modul dalam aplikasi, seperti:

* Administrasi
* Pergudangan
* Keuangan
* Operasional
* SDM
* Logistik

---

# 1.6 Asumsi

Pengembangan modul didasarkan pada asumsi berikut:

* Template dokumen menggunakan format Microsoft Word (.docx).
* Seluruh placeholder mengikuti sintaks Docxtemplater.
* MinIO Object Storage telah tersedia dan dapat diakses oleh aplikasi.
* LibreOffice Headless belum terpasang pada server aplikasi.
* Pengguna memiliki hak akses terhadap modul sesuai mekanisme autentikasi aplikasi.
* Seluruh metadata dokumen disimpan pada PostgreSQL.

---

# 1.7 Technology Stack

| Component       | Technology                          |
| --------------- | ----------------------------------- |
| Frontend        | Next.js + React + TypeScript        |
| Backend         | NestJS + TypeScript                 |
| Database        | PostgreSQL + Prisma ORM             |
| Document Engine | Docxtemplater                       |
| DOCX Parser     | PizZip                              |
| PDF Converter   | LibreOffice Headless                |
| Object Storage  | MinIO                               |
| API             | REST API                            |
| Authentication  | Existing Application Authentication |

---

# 1.8 Success Metrics

Modul dianggap berhasil apabila memenuhi indikator berikut:

* Administrator dapat mengunggah template tanpa perubahan kode aplikasi.
* Placeholder dapat dideteksi secara otomatis dari template DOCX.
* Form input dibangun secara dinamis berdasarkan `PLACEHOLDER_SCHEMA`.
* Dokumen DOCX berhasil dihasilkan dengan isi sesuai data yang diberikan.
* PDF berhasil dihasilkan dengan tata letak yang konsisten.
* Seluruh file tersimpan pada MinIO.
* Metadata dokumen tersimpan pada `DOCUMENT_GENERATED`.
* Dokumen dapat diunduh kembali menggunakan Presigned URL.
* Penambahan template baru tidak memerlukan deployment ulang aplikasi.

# 2. Business Process & Workflow

## 2.1 Overview

Modul **Document Template Management & Document Generator** terdiri dari tiga proses utama:

1. **Template Management** — Mengelola template Microsoft Word beserta metadata dan placeholder.
2. **Document Assembly** — Menyusun struktur dokumen yang terdiri dari template utama, section, dan lampiran.
3. **Document Generation** — Menghasilkan dokumen akhir berdasarkan konfigurasi assembly, kemudian menyimpan hasil generate ke MinIO beserta metadata dokumen.

---

# 2.2 Business Process

## A. Template Management

Administrator mengelola template Microsoft Word (.docx) yang akan digunakan sebagai dasar pembuatan dokumen.

### Workflow

1. Upload template (.docx).
2. Template disimpan ke MinIO.
3. Sistem membaca placeholder menggunakan **Docxtemplater**.
4. Sistem menghasilkan `PLACEHOLDER_SCHEMA`.
5. Metadata template disimpan ke `DOCUMENT_TEMPLATE`.
6. Template siap digunakan.

---

## B. Document Assembly

Administrator dapat menyusun satu dokumen akhir menggunakan beberapa komponen dokumen.

Komponen yang didukung meliputi:

* Main Template (.docx)
* Section Template (.docx)
* Lampiran PDF

Setiap komponen memiliki konfigurasi:

* Urutan (Order)
* Jenis Komponen
* Posisi Penyisipan
* Wajib / Opsional
* Kondisi Penyisipan (Conditional)

Contoh struktur:

```text
Surat Penagihan
├── Halaman Utama
├── Lampiran Tagihan
├── Berita Acara
├── Lampiran PDF
└── Tanda Terima
```

Konfigurasi tersebut disimpan sebagai bagian dari template sehingga setiap proses generate akan mengikuti struktur yang telah ditentukan.

---

## C. Document Generation

Pengguna menghasilkan dokumen berdasarkan template yang dipilih.

### Workflow

1. Pilih Template.
2. Sistem mengambil konfigurasi Document Assembly.
3. Sistem membaca `PLACEHOLDER_SCHEMA`.
4. Frontend membangun Dynamic Form.
5. Pengguna mengisi seluruh placeholder.
6. Sistem melakukan validasi.
7. Sistem menghasilkan setiap Template/Section menjadi DOCX.
8. Seluruh section DOCX digabungkan menjadi satu dokumen.
9. Dokumen DOCX disimpan ke MinIO.
10. DOCX dikonversi menjadi PDF menggunakan LibreOffice Headless.
11. Sistem menyisipkan seluruh lampiran PDF sesuai konfigurasi assembly.
12. Seluruh PDF digabungkan menjadi satu Final PDF.
13. Final PDF disimpan ke MinIO.
14. Metadata dokumen disimpan pada `DOCUMENT_GENERATED`.
15. Pengguna dapat melakukan Preview maupun Download.

---

# 2.3 End-to-End Workflow

```text
Upload Template
        │
        ▼
Upload ke MinIO
        │
        ▼
Auto Detect Placeholder
        │
        ▼
Generate Placeholder Schema
        │
        ▼
Save DOCUMENT_TEMPLATE
        │
        ▼
Configure Document Assembly
        │
        ▼
Template Ready
        │
        ▼
Select Template
        │
        ▼
Generate Dynamic Form
        │
        ▼
Input Placeholder
        │
        ▼
Validation
        │
        ▼
Generate Main Template
        │
        ▼
Generate Section Templates
        │
        ▼
Merge DOCX
        │
        ▼
Upload DOCX ke MinIO
        │
        ▼
Convert DOCX → PDF
        │
        ▼
Insert PDF Attachments
        │
        ▼
Merge Final PDF
        │
        ▼
Upload Final PDF ke MinIO
        │
        ▼
Insert DOCUMENT_GENERATED
        │
        ▼
Preview / Download
```

---

# 2.4 Document Assembly Flow

```text
Main Template
      │
      ▼
Section 1
      │
      ▼
Section 2
      │
      ▼
DOCX Merged
      │
      ▼
Convert PDF
      │
      ▼
PDF Attachment 1
      │
      ▼
PDF Attachment 2
      │
      ▼
Final PDF
```

---

# 2.5 Document Lifecycle

```text
Template Created
        │
        ▼
Template Active
        │
        ▼
Document Generated
        │
        ▼
Preview
        │
        ▼
Downloaded
        │
        ├────────► Deleted (Soft Delete)
        │
        ▼
Signed (Future)
        │
        ▼
Archived (Future)
```

---

# 2.6 Data Flow

| Process                 | Output                   |
| ----------------------- | ------------------------ |
| Upload Template         | Template DOCX            |
| Auto Detect Placeholder | PLACEHOLDER_SCHEMA       |
| Configure Assembly      | Assembly Configuration   |
| Generate Template       | DOCX                     |
| Merge DOCX              | Final DOCX               |
| Convert PDF             | Initial PDF              |
| Insert PDF Attachment   | Final PDF                |
| Upload File             | DOCX Object & PDF Object |
| Save Metadata           | DOCUMENT_GENERATED       |

---

# 2.7 Integration

| Component            | Responsibility                                       |
| -------------------- | ---------------------------------------------------- |
| Docxtemplater        | Membaca placeholder dan menghasilkan DOCX            |
| PizZip               | Membaca struktur file DOCX                           |
| LibreOffice Headless | Konversi DOCX menjadi PDF                            |
| PDF Merge Engine     | Menggabungkan PDF hasil generate dengan lampiran PDF |
| MinIO                | Penyimpanan template dan dokumen                     |
| PostgreSQL           | Metadata template dan dokumen                        |
| Next.js              | Dynamic Form & Document Management                   |
| NestJS               | Orkestrasi seluruh proses generate dokumen           |

# 3. Functional Requirements

## 3.1 Template Management

### Deskripsi

Modul Template Management digunakan untuk mengelola seluruh template dokumen yang akan digunakan pada proses generate dokumen.

### Functional Requirements

* Membuat template baru.
* Mengunggah template Microsoft Word (.docx).
* Mengubah metadata template.
* Mengaktifkan atau menonaktifkan template.
* Membuat versi baru (Versioning).
* Melihat detail template.
* Soft Delete template.
* Menyimpan template pada MinIO.
* Mengelola Document Assembly.
* Mengelola Placeholder Schema.

### Acceptance Criteria

* Template berhasil disimpan.
* Template memiliki versi.
* Template dapat digunakan pada proses generate.

---

# 3.2 Auto Detect Placeholder

### Deskripsi

Setelah template berhasil diunggah, sistem secara otomatis membaca seluruh placeholder menggunakan **Docxtemplater**.

### Functional Requirements

* Membaca seluruh placeholder.
* Menghasilkan `PLACEHOLDER_SCHEMA`.
* Menyimpan schema pada `DOCUMENT_TEMPLATE`.
* Sinkronisasi schema ketika template diperbarui.

### Supported Placeholder Type

* TEXT
* TEXTAREA
* NUMBER
* CURRENCY
* DATE
* TIME
* DATETIME
* BOOLEAN
* SELECT
* MULTI_SELECT
* IMAGE
* TABLE

### Acceptance Criteria

* Placeholder berhasil dibaca.
* Tidak diperlukan konfigurasi placeholder secara manual.

---

# 3.3 Dynamic Form

### Deskripsi

Form Generate Document dibangun secara otomatis berdasarkan `PLACEHOLDER_SCHEMA`.

### Functional Requirements

* Generate Form otomatis.
* Validasi Required Field.
* Default Value.
* Dynamic Component berdasarkan tipe placeholder.
* Validasi sebelum proses generate.

### Acceptance Criteria

* Form mengikuti Placeholder Schema.
* Field tervalidasi dengan benar.

---

# 3.4 Document Assembly

### Deskripsi

Document Assembly digunakan untuk menyusun satu dokumen dari beberapa komponen dokumen.

### Supported Component

* Main Template (.docx)
* Section Template (.docx)
* PDF Attachment

### Functional Requirements

* Menambahkan Section Template.
* Menambahkan Lampiran PDF.
* Mengatur urutan komponen.
* Mengatur kondisi penyisipan.
* Mengatur posisi lampiran PDF.
* Menyimpan konfigurasi pada `ASSEMBLY_SCHEMA`.

### Supported Position

* AFTER_DOCUMENT
* AFTER_SECTION
* BEFORE_SECTION
* LAST_PAGE

### Acceptance Criteria

* Assembly mengikuti konfigurasi.
* Seluruh komponen berhasil disusun.
* PDF Attachment berada pada posisi yang benar.

---

# 3.5 Generate Document

### Deskripsi

Menghasilkan dokumen berdasarkan Template dan Document Assembly.

### Workflow

1. Pilih Template.
2. Load Placeholder Schema.
3. Load Assembly Schema.
4. Input Data.
5. Validasi.
6. Generate Main Template.
7. Generate Section.
8. Merge DOCX.
9. Upload DOCX.
10. Convert PDF.
11. Merge PDF Attachment.
12. Upload Final PDF.
13. Simpan Metadata.
14. Preview.

### Acceptance Criteria

* DOCX berhasil dibuat.
* PDF berhasil dibuat.
* Metadata tersimpan.
* File berhasil diunggah ke MinIO.

---

# 3.6 Preview Document

### Functional Requirements

* Preview PDF.
* Menampilkan metadata dokumen.
* Menampilkan informasi Template.
* Menampilkan Status.

### Acceptance Criteria

* Preview berhasil ditampilkan.
* Metadata sesuai.

---

# 3.7 Download Document

### Functional Requirements

* Download DOCX.
* Download PDF.
* Download menggunakan Presigned URL.

### Acceptance Criteria

* File berhasil diunduh.
* URL hanya berlaku sementara.

---

# 3.8 Document History

### Deskripsi

Menampilkan seluruh dokumen yang pernah dihasilkan.

### Functional Requirements

* List Document.
* Search.
* Filter.
* Sorting.
* Preview.
* Download.

### Filter

* Template
* Kategori
* Status
* Generated By
* Date Range

### Acceptance Criteria

* Dokumen dapat ditemukan dengan mudah.
* Filter bekerja sesuai kriteria.

---


### Functional Requirements

* Upload Template.
* Upload DOCX.
* Upload PDF.
* Generate Presigned URL.
* Delete Object.

### Acceptance Criteria

* Object Key unik.
* Metadata tersimpan.
* File dapat diakses melalui Presigned URL.

---

# 3.9 Validation

Sebelum proses generate, sistem melakukan validasi terhadap:

* Template tersedia.
* Template aktif.
* Placeholder wajib telah diisi.
* Template DOCX valid.
* Assembly valid.
* Seluruh Section tersedia.
* Seluruh Lampiran PDF tersedia.
* Generate DOCX berhasil.
* Konversi PDF berhasil.
* Upload MinIO berhasil.

Apabila salah satu validasi gagal maka proses generate dibatalkan.

---

# 3.10 Audit Log

Seluruh aktivitas dicatat sebagai audit trail.

### Aktivitas

* Upload Template
* Update Template
* New Version
* Update Assembly
* Generate Document
* Download Document
* Failed Generate
* Failed Convert PDF
* Failed Upload

### Acceptance Criteria

* Seluruh aktivitas memiliki Timestamp.
* Seluruh aktivitas memiliki User.
* Log dapat digunakan untuk audit.

---

# 3.11 Error Handling

| Condition                | Action             |
| ------------------------ | ------------------ |
| Template tidak ditemukan | Batalkan proses    |
| Placeholder tidak valid  | Batalkan proses    |
| Assembly tidak valid     | Batalkan proses    |
| DOCX Generate gagal      | Batalkan proses    |
| PDF Convert gagal        | Batalkan proses    |
| PDF Merge gagal          | Batalkan proses    |
| Upload MinIO gagal       | Rollback transaksi |
| Database gagal           | Rollback transaksi |

---


# 4. Database Design

## 4.1 Overview

Modul **Document Template Management & Document Generator** menggunakan PostgreSQL sebagai media penyimpanan metadata dokumen. Seluruh file fisik disimpan pada MinIO, sedangkan database hanya menyimpan metadata dan Object Key.

Database dirancang agar fleksibel, mendukung versioning template, document assembly, placeholder schema, serta histori dokumen yang dihasilkan.

---

# 4.2 Entity Relationship

Modul terdiri dari beberapa entitas utama.

```text id="7f4x9n"
DOCUMENT_CATEGORY
        │
        │
        ▼
DOCUMENT_TEMPLATE
        │
        │
        ▼
DOCUMENT_GENERATED
```

---

# 4.3 DOCUMENT_CATEGORY

Digunakan untuk mengelompokkan template berdasarkan jenis dokumen.

| Column      | Type         | Description       |
| ----------- | ------------ | ----------------- |
| ID          | BIGSERIAL    | Primary Key       |
| UUID        | UUID         | Public Identifier |
| CODE        | VARCHAR(50)  | Kode kategori     |
| NAME        | VARCHAR(150) | Nama kategori     |
| DESCRIPTION | TEXT         | Deskripsi         |
| IS_ACTIVE   | BOOLEAN      | Status aktif      |
| CREATED_AT  | TIMESTAMPTZ  | Waktu dibuat      |
| UPDATED_AT  | TIMESTAMPTZ  | Waktu diperbarui  |
| DELETED_AT  | TIMESTAMPTZ  | Soft Delete       |

---

# 4.4 DOCUMENT_TEMPLATE

Menyimpan metadata template dokumen.

| Column             | Type         | Description                   |
| ------------------ | ------------ | ----------------------------- |
| ID                 | BIGSERIAL    | Primary Key                   |
| UUID               | UUID         | Public Identifier             |
| CATEGORY_ID        | BIGINT       | FK DOCUMENT_CATEGORY          |
| CODE               | VARCHAR(100) | Kode template                 |
| NAME               | VARCHAR(255) | Nama template                 |
| DESCRIPTION        | TEXT         | Deskripsi                     |
| VERSION            | INTEGER      | Versi template                |
| OBJECT_KEY         | VARCHAR(500) | Lokasi file DOCX di MinIO     |
| PLACEHOLDER_SCHEMA | JSONB        | Definisi placeholder          |
| ASSEMBLY_SCHEMA    | JSONB        | Konfigurasi Document Assembly |
| IS_ACTIVE          | BOOLEAN      | Status aktif                  |
| CREATED_BY         | BIGINT       | User pembuat                  |
| CREATED_AT         | TIMESTAMPTZ  | Waktu dibuat                  |
| UPDATED_AT         | TIMESTAMPTZ  | Waktu diperbarui              |
| DELETED_AT         | TIMESTAMPTZ  | Soft Delete                   |

---

# 4.5 DOCUMENT_GENERATED

Menyimpan metadata seluruh dokumen yang berhasil dihasilkan.

| Column             | Type         | Description                     |
| ------------------ | ------------ | ------------------------------- |
| ID                 | BIGSERIAL    | Primary Key                     |
| UUID               | UUID         | Public Identifier               |
| TEMPLATE_ID        | BIGINT       | FK DOCUMENT_TEMPLATE            |
| CATEGORY_ID        | BIGINT       | FK DOCUMENT_CATEGORY            |
| TITLE              | VARCHAR(255) | Judul dokumen                   |
| DOCUMENT_NUMBER    | VARCHAR(150) | Nomor dokumen                   |
| DOCX_OBJECT_KEY    | VARCHAR(500) | Lokasi file DOCX                |
| PDF_OBJECT_KEY     | VARCHAR(500) | Lokasi file PDF                 |
| FILE_HASH          | VARCHAR(255) | Hash dokumen                    |
| VERIFICATION_TOKEN | VARCHAR(255) | Token verifikasi                |
| GENERATED_BY       | BIGINT       | User generator                  |
| GENERATED_AT       | TIMESTAMPTZ  | Waktu generate                  |
| STATUS             | VARCHAR(30)  | PROCESSING / GENERATED / FAILED |
| CREATED_AT         | TIMESTAMPTZ  | Waktu dibuat                    |
| UPDATED_AT         | TIMESTAMPTZ  | Waktu diperbarui                |
| DELETED_AT         | TIMESTAMPTZ  | Soft Delete                     |

---

# 4.6 JSON Schema

## PLACEHOLDER_SCHEMA

Berisi definisi seluruh placeholder yang digunakan untuk membangun Dynamic Form.

Contoh:

```json id="h8n4mz"
[
  {
    "key": "nomor_surat",
    "label": "Nomor Surat",
    "type": "TEXT",
    "required": true
  },
  {
    "key": "tanggal",
    "label": "Tanggal Surat",
    "type": "DATE",
    "required": true
  },
  {
    "key": "penerima",
    "label": "Penerima",
    "type": "TEXT",
    "required": true
  }
]
```

---

## ASSEMBLY_SCHEMA

Menyimpan konfigurasi penyusunan dokumen.

Contoh:

```json id="u4xw1v"
[
  {
    "type": "TEMPLATE",
    "templateCode": "SURAT_PENAGIHAN",
    "order": 1
  },
  {
    "type": "TEMPLATE",
    "templateCode": "BERITA_ACARA",
    "order": 2,
    "condition": "HAS_BA == true"
  },
  {
    "type": "PDF",
    "source": "USER_UPLOAD",
    "position": "AFTER_DOCUMENT"
  }
]
```

---

# 4.7 Relationship

| Parent            | Child              | Relationship |
| ----------------- | ------------------ | ------------ |
| DOCUMENT_CATEGORY | DOCUMENT_TEMPLATE  | One to Many  |
| DOCUMENT_CATEGORY | DOCUMENT_GENERATED | One to Many  |
| DOCUMENT_TEMPLATE | DOCUMENT_GENERATED | One to Many  |

---

# 4.8 Index Recommendation

| Table              | Index           |
| ------------------ | --------------- |
| DOCUMENT_CATEGORY  | CODE            |
| DOCUMENT_TEMPLATE  | CODE            |
| DOCUMENT_TEMPLATE  | CATEGORY_ID     |
| DOCUMENT_TEMPLATE  | IS_ACTIVE       |
| DOCUMENT_GENERATED | TEMPLATE_ID     |
| DOCUMENT_GENERATED | CATEGORY_ID     |
| DOCUMENT_GENERATED | DOCUMENT_NUMBER |
| DOCUMENT_GENERATED | GENERATED_AT    |
| DOCUMENT_GENERATED | STATUS          |

---

# 4.9 Design Principles

* Metadata disimpan di PostgreSQL.
* File fisik disimpan di MinIO menggunakan Object Key.
* Placeholder dan Document Assembly menggunakan JSONB agar fleksibel tanpa memerlukan perubahan skema database.
* Seluruh tabel menggunakan UUID sebagai Public Identifier.
* Seluruh tabel mendukung Soft Delete.
* Seluruh perubahan template dilakukan melalui mekanisme Versioning.

# 5. API Specification

## 5.1 Overview

Modul **Document Template Management & Document Generator** menyediakan REST API untuk mengelola template dokumen, document assembly, proses generate dokumen, penyimpanan metadata, serta akses terhadap file yang tersimpan di MinIO.

Seluruh API menggunakan format **JSON** dan mengikuti standar RESTful API.

### Base URL

```text
/api/v1/document
```

### Authentication

Seluruh endpoint memerlukan autentikasi menggunakan JWT Bearer Token.

```
Authorization: Bearer <access_token>
```

---

# 5.2 Template Management API

## Get Template List

```
GET /templates
```

### Query Parameter

| Parameter  | Type    | Description             |
| ---------- | ------- | ----------------------- |
| page       | Number  | Nomor halaman           |
| limit      | Number  | Jumlah data             |
| search     | String  | Nama atau kode template |
| categoryId | UUID    | Filter kategori         |
| active     | Boolean | Status template         |

### Response

```json
{
  "data": [],
  "pagination": {}
}
```

---

## Get Template Detail

```
GET /templates/{uuid}
```

### Response

```json
{
  "uuid": "...",
  "code": "SURAT_PENAGIHAN",
  "name": "Surat Penagihan",
  "version": 2,
  "placeholderSchema": [],
  "assemblySchema": []
}
```

---

## Create Template

```
POST /templates
```

### Request

| Field       | Type   | Required |
| ----------- | ------ | -------- |
| categoryId  | UUID   | ✓        |
| code        | String | ✓        |
| name        | String | ✓        |
| description | String |          |
| file        | DOCX   | ✓        |

### Process

* Upload DOCX ke MinIO.
* Auto Detect Placeholder.
* Generate PLACEHOLDER_SCHEMA.
* Simpan metadata template.

---

## Update Template

```
PUT /templates/{uuid}
```

Mengubah metadata template tanpa mengubah versi.

---

## Upload New Version

```
POST /templates/{uuid}/version
```

Mengunggah versi baru template.

### Process

* Upload DOCX baru.
* Generate Placeholder Schema baru.
* Menambah versi template.

---

## Delete Template

```
DELETE /templates/{uuid}
```

Soft Delete Template.

---

# 5.3 Document Assembly API

## Get Assembly

```
GET /templates/{uuid}/assembly
```

Mengambil konfigurasi Document Assembly.

---

## Update Assembly

```
PUT /templates/{uuid}/assembly
```

### Request

```json
[
  {
    "type": "TEMPLATE",
    "templateCode": "SURAT_PENAGIHAN",
    "order": 1
  },
  {
    "type": "PDF",
    "source": "USER_UPLOAD",
    "position": "AFTER_DOCUMENT"
  }
]
```

### Process

* Validasi struktur Assembly.
* Simpan ke `ASSEMBLY_SCHEMA`.

---

# 5.4 Placeholder API

## Get Placeholder Schema

```
GET /templates/{uuid}/placeholders
```

Mengambil schema placeholder untuk membangun Dynamic Form.

---

# 5.5 Document Generation API

## Generate Document

```
POST /generate
```

### Request

```json
{
  "templateId": "...",
  "title": "Surat Penagihan Juli 2026",
  "documentNumber": "001/SP/VII/2026",
  "placeholder": {
    "nomor_surat": "001/SP/VII/2026",
    "tanggal": "2026-07-29",
    "penerima": "PT ABC"
  },
  "attachments": [
    {
      "type": "PDF",
      "objectKey": "attachments/tagihan.pdf"
    }
  ]
}
```

### Process

* Load Template.
* Load Placeholder Schema.
* Load Assembly Schema.
* Validasi Input.
* Generate DOCX.
* Merge DOCX.
* Upload DOCX.
* Convert PDF.
* Merge PDF Attachment.
* Upload Final PDF.
* Simpan Metadata.

### Response

```json
{
  "uuid": "...",
  "status": "GENERATED"
}
```

---

# 5.6 Generated Document API

## Get Generated Documents

```
GET /generated
```

### Query Parameter

| Parameter   | Description           |
| ----------- | --------------------- |
| page        | Pagination            |
| limit       | Pagination            |
| search      | Judul / Nomor Dokumen |
| templateId  | Filter Template       |
| categoryId  | Filter Kategori       |
| status      | Status Generate       |
| generatedBy | User                  |
| startDate   | Tanggal Awal          |
| endDate     | Tanggal Akhir         |

---

## Get Generated Detail

```
GET /generated/{uuid}
```

Mengambil metadata dokumen beserta lokasi file.

---

## Preview Document

```
GET /generated/{uuid}/preview
```

Menghasilkan Presigned URL untuk preview PDF.

---

## Download DOCX

```
GET /generated/{uuid}/download/docx
```

Menghasilkan Presigned URL untuk file DOCX.

---

## Download PDF

```
GET /generated/{uuid}/download/pdf
```

Menghasilkan Presigned URL untuk file PDF.

---

## Delete Generated Document

```
DELETE /generated/{uuid}
```

Soft Delete metadata dokumen.

---

# 5.7 Storage API

## Upload Attachment

```
POST /storage/upload
```

Digunakan untuk mengunggah lampiran PDF yang akan digunakan pada proses generate.

### Supported File

* PDF

### Response

```json
{
  "objectKey": "attachments/2026/file.pdf"
}
```

---

## Delete Attachment

```
DELETE /storage
```

Menghapus object pada MinIO.

---

# 5.8 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

### Error Response

```json
{
  "success": false,
  "message": "Validation Failed",
  "errors": [
    {
      "field": "templateId",
      "message": "Template not found."
    }
  ]
}
```

---

# 5.9 HTTP Status Code

| Status Code | Description           |
| ----------- | --------------------- |
| 200         | Success               |
| 201         | Created               |
| 204         | No Content            |
| 400         | Bad Request           |
| 401         | Unauthorized          |
| 403         | Forbidden             |
| 404         | Not Found             |
| 409         | Conflict              |
| 422         | Validation Error      |
| 500         | Internal Server Error |

---

# 5.10 API Design Principles

* Menggunakan RESTful API.
* Seluruh endpoint menggunakan UUID sebagai Public Identifier.
* File tidak dikirim langsung melalui API, tetapi menggunakan Presigned URL MinIO.
* Seluruh request dan response menggunakan format JSON.
* Endpoint bersifat stateless.
* Seluruh operasi yang mengubah data dicatat pada Audit Log.
* Mendukung versioning template tanpa memengaruhi dokumen yang telah dihasilkan.


# 6. System Architecture & Component Design

## 6.1 Overview

Modul **Document Template Management & Document Generator** dibangun menggunakan arsitektur modular agar setiap komponen memiliki tanggung jawab yang jelas, mudah dipelihara, serta dapat dikembangkan secara independen.

Sistem terdiri dari beberapa komponen utama:

* Frontend (Next.js)
* Backend API (NestJS)
* PostgreSQL
* MinIO Object Storage
* Document Engine
* PDF Conversion Engine
* PDF Merge Engine

---

# 6.2 High Level Architecture

```text
                   User
                     │
                     ▼
               Next.js Frontend
                     │
             REST API (HTTPS)
                     │
                     ▼
              NestJS Backend API
                     │
 ┌─────────────┬──────────────┬──────────────┐
 ▼             ▼              ▼              ▼
PostgreSQL   MinIO     Document Engine   Queue Worker
                               │              │
                               ▼              ▼
                        LibreOffice     PDF Merge Engine
```

---

# 6.3 Component Architecture

## Frontend

Bertanggung jawab terhadap:

* Authentication
* Template Management
* Dynamic Form Generator
* Document Assembly Editor
* Document Preview
* Generated Document Management

Frontend tidak melakukan proses generate dokumen secara langsung, seluruh proses dilakukan melalui Backend API.

---

## Backend API

Backend berfungsi sebagai orchestration layer yang mengatur seluruh proses bisnis.

Tanggung jawab Backend meliputi:

* Validasi Request
* Authentication & Authorization
* CRUD Template
* CRUD Generated Document
* Placeholder Processing
* Document Assembly
* Document Generation
* File Upload
* Audit Log

---

## PostgreSQL

Digunakan untuk menyimpan metadata.

Data yang disimpan meliputi:

* Category
* Template
* Placeholder Schema
* Assembly Schema
* Generated Document
* Audit Log

Tidak menyimpan file fisik.

---

## MinIO

Digunakan sebagai Object Storage.

Menyimpan:

* Template DOCX
* Generated DOCX
* Generated PDF
* Attachment PDF

Akses file menggunakan Presigned URL.

---

## Document Engine

Menggunakan:

* Docxtemplater
* PizZip

Fungsi:

* Membaca Placeholder
* Menghasilkan Dynamic DOCX
* Merge Section Template

---

## PDF Conversion Engine

Menggunakan:

* LibreOffice Headless

Fungsi:

* Convert DOCX menjadi PDF

---

## PDF Merge Engine

Digunakan untuk:

* Menggabungkan hasil PDF Generate
* Menambahkan Lampiran PDF
* Menghasilkan Final PDF

---

# 6.4 Backend Module

```text
DocumentModule
│
├── CategoryModule
├── TemplateModule
├── AssemblyModule
├── PlaceholderModule
├── GenerateModule
├── StorageModule
├── ConverterModule
├── PreviewModule
├── AuditModule
└── WorkerModule
```

---

# 6.5 Module Responsibility

## CategoryModule

Mengelola kategori dokumen.

### Responsibility

* CRUD Category
* Active / Inactive

---

## TemplateModule

Mengelola Template.

### Responsibility

* Upload DOCX
* Versioning
* Metadata
* Placeholder Schema

---

## AssemblyModule

Mengelola konfigurasi Document Assembly.

### Responsibility

* Menambah Section
* Menambah Lampiran
* Menentukan Urutan
* Menentukan Posisi
* Menyimpan Assembly Schema

---

## PlaceholderModule

Mengelola Placeholder.

### Responsibility

* Parse Placeholder
* Generate Schema
* Validation

---

## GenerateModule

Core Business Process.

### Responsibility

* Generate DOCX
* Merge Template
* Convert PDF
* Upload File
* Save Metadata

---

## StorageModule

Mengelola komunikasi dengan MinIO.

### Responsibility

* Upload Object
* Download Object
* Delete Object
* Presigned URL

---

## ConverterModule

Berkomunikasi dengan LibreOffice.

### Responsibility

* DOCX → PDF

---

## PreviewModule

Menghasilkan Preview PDF.

### Responsibility

* Generate Presigned URL
* Preview Metadata

---

## AuditModule

Mencatat seluruh aktivitas sistem.

---

## WorkerModule

Menjalankan proses generate secara asynchronous.

---

# 6.6 Document Generation Sequence

```text
User
 │
 ▼
Select Template
 │
 ▼
Load Template
 │
 ▼
Load Placeholder Schema
 │
 ▼
Load Assembly Schema
 │
 ▼
Dynamic Form
 │
 ▼
Submit Generate
 │
 ▼
Validation
 │
 ▼
Queue Generate Job
 │
 ▼
Worker Process
 │
 ▼
Generate DOCX
 │
 ▼
Merge DOCX
 │
 ▼
Upload DOCX
 │
 ▼
Convert PDF
 │
 ▼
Merge PDF Attachment
 │
 ▼
Upload Final PDF
 │
 ▼
Save Metadata
 │
 ▼
Update Status
```

---

# 6.7 Storage Architecture

```text
MinIO

document-template/
│
├── templates/
│   ├── memo/
│   ├── surat/
│   └── berita-acara/
│
├── generated/
│   ├── 2026/
│   │    ├── 07/
│   │    └── 08/
│   └── ...
│
└── attachment/
     ├── 2026/
     └── ...
```

Database hanya menyimpan Object Key.

Contoh:

```text
templates/memo/v3.docx

generated/2026/07/UUID.pdf

generated/2026/07/UUID.docx

attachment/2026/file.pdf
```

---

# 6.8 Asynchronous Processing

Proses generate dokumen dijalankan secara asynchronous menggunakan Job Queue.

Tahapan:

1. API menerima permintaan generate.
2. Metadata awal disimpan dengan status **PROCESSING**.
3. Job dikirim ke Queue.
4. Worker mengambil Job.
5. Worker menghasilkan DOCX.
6. Worker mengunggah DOCX.
7. Worker mengonversi PDF.
8. Worker menggabungkan lampiran PDF.
9. Worker mengunggah Final PDF.
10. Status diubah menjadi **GENERATED**.

Apabila terjadi kegagalan pada salah satu tahapan, status diubah menjadi **FAILED** beserta informasi error.

---

# 6.9 Error Handling Flow

```text
Generate Request
        │
        ▼
Validation
        │
        ├────────────── Invalid
        │                  │
        │                  ▼
        │             Return Error
        │
        ▼
Generate DOCX
        │
        ├────────────── Failed
        │                  │
        ▼                  ▼
Convert PDF         Update Status FAILED
        │
        ├────────────── Failed
        │                  │
        ▼                  ▼
Merge PDF         Update Status FAILED
        │
        ├────────────── Failed
        │                  │
        ▼                  ▼
Upload File       Update Status FAILED
        │
        ▼
Status GENERATED
```

---

# 6.10 Scalability

Arsitektur dirancang agar mudah dikembangkan.

Mendukung:

* Multiple Worker
* Multiple Backend Instance
* Load Balancer
* Horizontal Scaling
* Object Storage Cluster
* Database Replication
* Queue Scaling

---

# 6.11 Design Principles

* Modular Architecture.
* Separation of Concern.
* RESTful API.
* Stateless Backend.
* Asynchronous Document Generation.
* Object Storage untuk seluruh file.
* Metadata dipisahkan dari file fisik.
* Seluruh proses dapat diaudit.
* Mudah dikembangkan untuk Digital Signature, Approval Workflow, Batch Generation, dan Integrasi Sistem Eksternal.
