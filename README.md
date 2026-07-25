# ZaamMusic

Aplikasi pencarian & pemutar audio (audio-only, tanpa video) dengan tata
letak dasbor Home & Cari terinspirasi Spotify, dipadu tema visual "tuner /
cassette deck" milik ZaamMusic sendiri. Pencarian memanggil
langsung API internal YouTube (`youtubei/v1/search`, endpoint JSON yang
dipakai web client YouTube sendiri) alih-alih men-scrape halaman HTML seperti
`yt-search` — ini jauh lebih stabil dijalankan dari IP data center (Netlify
Functions), karena tidak tersandung halaman "consent"/cookie-wall yang sering
menghadang scraping HTML dari server cloud. Hasil di tab Home di-cache 1 jam
dengan `node-cache`.

## Struktur

```
zaammusic/
├─ netlify.toml              # config build + redirect /api/* -> functions
├─ package.json              # deps: node-cache (search pakai fetch bawaan Node)
├─ netlify/functions/
│  ├─ lib/ytApiSearch.js     # pemanggil API internal YouTube (youtubei/v1/search)
│  ├─ tophits.js             # GET /api/tophits — di-cache 1 jam (node-cache)
│  └─ search.js              # GET /api/search?q=... — pencarian on-demand
└─ public/                   # situs statis (folder publish)
   ├─ index.html             # shell SPA: Home / Cari / Pustaka / Info
   ├─ css/style.css
   └─ js/app.js
```

## Catatan jujur soal pendekatan pencarian

`ytApiSearch.js` memanggil endpoint JSON internal yang dipakai youtube.com
sendiri (bukan API resmi berbayar/API key pribadi). Ini lebih tahan
terhadap pemblokiran IP data center dibanding scraping HTML, tapi tetap
bukan kontrak resmi publik — kalau YouTube mengubah struktur respons
internalnya, fungsi ini bisa berhenti bekerja dan perlu disesuaikan lagi.
Kalau butuh jaminan stabilitas jangka panjang, opsi paling aman adalah
YouTube Data API v3 resmi dengan API key (ada kuota gratis harian, tapi
perlu didaftarkan di Google Cloud Console).

## Tab

- **Home** (`/home`) — dasbor gaya Spotify: grid akses cepat (Lagu yang
  Disukai, lagu baru diputar), lalu Top Hits dari `/api/tophits`. Hasil
  Top Hits disimpan di memori server (node-cache, TTL 3600 detik) sehingga
  hanya diperbarui maksimal sekali per jam per instance function yang
  sedang aktif.
- **Cari** (`/search`) — pencarian bebas via `/api/search?q=...` (ketik
  lalu tekan enter, atau tunggu sebentar untuk pencarian otomatis), tanpa
  cache (selalu hasil terbaru), ditampilkan sebagai daftar baris seperti
  hasil pencarian Spotify.
- **Pustaka** — daftar lagu yang disimpan lewat ikon hati, tersimpan di
  `localStorage` perangkat pengguna sendiri — tidak ada akun/server storage.
- **Info** — penjelasan singkat tentang aplikasi & sumber data.

## Audio-only, tanpa video

Pemutar YouTube IFrame API dimuat ke dalam elemen `#hiddenPlayer` yang
diberi `width/height: 0` dan diposisikan di luar layar (`left:-9999px`),
jadi video-nya tidak pernah tampil di antarmuka. Yang terlihat pengguna
hanya sampul, judul, dan tombol putar/jeda pada bar "deck" di bawah layar.

## Deploy ke Netlify

**Opsi A — drag & drop (paling cepat):**
1. Ekstrak zip ini.
2. Buka https://app.netlify.com/drop dan seret seluruh folder `zaammusic/`
   ke halaman tersebut.
3. Netlify otomatis membaca `netlify.toml`, meng-install dependency
   (`yt-search`, `node-cache`), membundel function, dan mem-publish folder
   `public/`.

**Opsi B — Netlify CLI:**
```bash
npm install
netlify deploy --prod
```

**Opsi C — hubungkan repo Git:** push folder ini ke GitHub/GitLab lalu
"Import an existing project" di Netlify. Build command tidak diperlukan
(situs statis), publish directory `public`, functions directory
`netlify/functions` — semua sudah diatur lewat `netlify.toml`.

## Catatan jujur soal cache 1 jam

Netlify Functions berjalan di lingkungan serverless: cache di memori
(`node-cache`) bertahan selama instance function tersebut masih "warm".
Kalau Netlify mematikan/mengganti instance (cold start), cache akan
kosong lagi dan data top hits diambil ulang — ini batasan umum semua
cache in-memory di platform serverless, bukan cuma di proyek ini. Untuk
cache yang benar-benar persisten lintas instance, langkah lanjutannya
adalah memakai Netlify Blobs atau storage eksternal (Redis, dsb).

## Sumber & etika penggunaan

Data lagu bersumber dari YouTube melalui pustaka `yt-search`. Hormati hak
cipta pemilik konten dan gunakan sesuai ketentuan layanan YouTube.
