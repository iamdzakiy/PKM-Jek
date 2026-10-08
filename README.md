# Second Brain — PKM AI Memory (private)

Aplikasi personal knowledge management dengan augmentasi memori berbasis AI:
**Memory Buoyancy**, **Preservation Value**, **Managed Forgetting** (folder
injeksi ♦Last Focus♦ / ♦Hot Topics♦ / ♦Forgotten♦), ontologi **PIMO**
(Project/Topic/Person/Event/Task/Note), dan **Active Recall** dengan
penjadwalan spaced-repetition H+1/H+7/H+30.

Dibangun private untuk satu orang: hanya satu alamat email (`ALLOWED_EMAIL`)
yang bisa masuk, ditegakkan di `middleware.ts` pada setiap request — bukan
hanya di halaman login.

Stack: Next.js 14 (App Router, Server Actions) · TypeScript · Tailwind ·
Prisma · Supabase (Postgres + Auth, magic link, tanpa password).

## Struktur direktori

```
prisma/
  schema.prisma          # model data; MemoryFolder kini punya TIME_CAPSULE
  seed.ts                # data contoh opsional

src/
  middleware.ts          # gerbang privasi: sesi + ALLOWED_EMAIL (cron dikecualikan)
  app/
    (auth)/login/        # masuk dengan magic link
    (dashboard)/         # semua halaman terproteksi
      page.tsx           # dashboard: mode Autopilot / Mindfulness
      notes/ [id]/       # daftar + editor catatan, rincian PV, koneksi
      recall/            # kuis active recall, satu kartu per layar
      tasks/ projects/ topics/ people/ events/
      engine/            # lab Pembobotan (kurva MB + kalkulator PV)
    actions/             # Server Actions (semua mengembalikan {ok, message})
    api/recompute-scores # cron: GET (Vercel) dan POST (manual)
  components/
    ui/                  # Button, Card, Input, Badge, Segmented, Toast, ActionForm
    motion/              # Stagger, Reveal, CountUp, GrowBar (Framer Motion)
    pkm/                 # Sidebar, TopBar, QuickCapture, NotesBoard, RecallDeck, ...
  lib/
    memory/scoring.ts    # rumus MB, PV, kategorisasi folder, THRESHOLDS
    memory/refresh.ts    # hitung ulang skor per catatan / seluruh vault
    memory/recall.ts     # penjadwalan spaced repetition
    notes-service.ts     # satu jalur pembuatan catatan (form + tangkap cepat)
```

## Desain

Palet GSIC: biru `#3352CD`, mint `#5CE3B6`, krem `#F2F8C9`, navy `#0B1120` / `#111C33`.
Heading Plus Jakarta Sans, teks Inter. Default tema gelap (navy GSIC), tema terang
mengikuti portal GSIC. Semua warna adalah token di `src/app/globals.css`; ganti di
sana dan seluruh aplikasi ikut berubah. Animasi memakai Framer Motion dan
menghormati `prefers-reduced-motion`.

Pintasan: `Ctrl/Cmd + K` atau `C` membuka Tangkap Cepat. Di dalamnya, `#task`, `#idea`,
`#insight` menentukan tipe, tag lain menjadi topik, baris pertama menjadi judul.

## Setup

### 1. Buat proyek Supabase

1. https://supabase.com → New project.
2. **Settings → API**: salin `Project URL` dan `anon public` key ke
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Settings → API**: salin `service_role` key ke `SUPABASE_SERVICE_ROLE_KEY`
   (tidak dipakai langsung oleh app ini, disiapkan untuk kebutuhan admin di
   masa depan — jangan pernah kirim ke client).
4. **Settings → Database → Connection string**: salin connection string mode
   *Transaction* (port 6543) ke `DATABASE_URL`, dan mode *Session*/direct
   (port 5432) ke `DIRECT_URL`.
5. **Authentication → Providers**: pastikan Email provider aktif, matikan
   "Confirm email" jika ingin magic link langsung aktif tanpa konfirmasi
   ganda (opsional).
6. **Authentication → URL Configuration**: tambahkan
   `http://localhost:3000/api/auth/callback` (dev) dan
   `https://domain-kamu.com/api/auth/callback` (production) ke Redirect URLs.

### 2. Salin environment variables

```bash
cp .env.example .env
```

Isi semua nilai, termasuk `ALLOWED_EMAIL=akbarussadatprof@gmail.com` — ini
satu-satunya email yang boleh login. Set juga `NEXT_PUBLIC_SITE_URL` (dipakai
untuk redirect magic link) dan `CRON_SECRET` (string acak panjang).

### 3. Install & migrasi

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Buka http://localhost:3000 → akan diarahkan ke `/login` → masukkan email
yang sama dengan `ALLOWED_EMAIL` → cek inbox → klik link → masuk ke
dashboard.

### 4. (Opsional) Data contoh

Jalankan `npx prisma migrate dev` dulu (enum baru `TIME_CAPSULE`). Setelah login pertama kali, cari `id` kamu di tabel `User` (Prisma Studio:
`npm run prisma:studio`), lalu:

```bash
SEED_USER_ID=<id-kamu> npm run seed
```

### 5. Deploy (disarankan: Vercel)

1. Push repo ini ke GitHub (private repo — `.env` sudah di-`.gitignore`).
2. Import ke Vercel, tambahkan semua environment variables yang sama.
3. `vercel.json` sudah menyertakan cron harian ke `/api/recompute-scores`
   (jam 02:00 UTC) yang menghitung ulang Memory Buoyancy, Preservation
   Value, dan kategori folder (♦Last Focus♦/♦Hot Topics♦/♦Forgotten♦) untuk
   semua catatan — Vercel otomatis mengirim header
   `Authorization: Bearer $CRON_SECRET`.
4. Tambahkan URL Vercel kamu ke Supabase **Authentication → URL
   Configuration → Redirect URLs**.

## Troubleshooting

### Login: "Email rate limit exceeded"

Error ini datang dari Supabase, bukan dari aplikasi. Provider email bawaan
Supabase hanya mengizinkan **2 email magic link per jam** (per proyek) dan
jeda **60 detik** sebelum user yang sama boleh meminta link lagi; saat
melewatinya Supabase membalas `429` / `over_email_send_rate_limit`.

- Tunggu ±1 jam lalu coba lagi, **atau** naikkan kuotanya di Supabase →
  **Authentication → Rate Limits** (*Emails sent per hour* dan *Send OTPs or
  magic links*). Kalau butuh lebih, aktifkan custom SMTP di
  **Authentication → Providers → Email**.
- Form login sekarang menerjemahkan error ini ke pesan Indonesia yang bisa
  ditindaklanjuti, dan memaksa jeda 60 detik setelah pengiriman sukses supaya
  klik ganda / reload tidak membakar kuota.
- Catatan: server action dijalankan dari IP server (bukan IP browser), jadi
  limit berbasis IP juga dihitung dari satu alamat yang sama.

## Cara kerja skor memori

- **Memory Buoyancy (MB)** dari log `Interaction` (CREATE/EDIT/COMMENT/VIEW), diluruhkan
  eksponensial (`src/lib/memory/scoring.ts`). Dihitung ulang seketika saat catatan
  dibuka, diedit, dikuis, atau topiknya diubah, dan penuh setiap malam lewat cron.
- **Preservation Value (PV)** = UI, Gravity, Social Graph, Popularity, Coverage, Quality
  dengan bobot 0.25 / 0.20 / 0.15 / 0.15 / 0.15 / 0.10. Rinciannya terlihat di setiap catatan.
- **Folder**: `LAST_FOCUS` jika disentuh dalam 3 hari dan MB di atas 50%; `HOT_TOPICS` jika
  terhubung ke topik hot; saat MB di bawah 30%, `TIME_CAPSULE` bila PV 60% ke atas, selain itu
  `FORGOTTEN` (disembunyikan, tidak pernah dihapus); selain itu `ACTIVE`.
  Semua ambang ada di `THRESHOLDS`.
- **Active Recall**: jawaban benar memperpanjang interval 1 → 7 → 30 → 90 hari; salah kembali
  ke 1 hari. Kuis jatuh tempo bila `nextReviewAt` sudah lewat.

## Keamanan & privasi

- `middleware.ts` menolak setiap request yang sesinya bukan milik
  `ALLOWED_EMAIL`, termasuk sesi yang sudah valid di Supabase tapi bukan
  emailmu — jadi berbagi link deploy tidak membuka data kamu.
- Login tanpa password (magic link) — tidak ada kredensial untuk dibobol
  lewat brute force.
- Semua query Prisma difilter `userId`, jadi meskipun di masa depan kamu
  menambah pengguna lain, data tetap terisolasi per akun.
