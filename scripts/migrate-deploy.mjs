// Jalankan `prisma migrate deploy` saat build, dengan satu pemulihan:
// 20261027010000_latihan_peran_review sempat gagal di database (nama dan isi
// migrasinya diganti setelah versi aslinya diterapkan). Prisma menolak migrasi
// baru selama ada migrasi gagal, jadi tandai yang itu "rolled back" dulu.
// Tidak ada perubahan skema dari langkah ini; kalau statusnya bukan gagal,
// perintahnya cuma menolak dan build lanjut.
import { execSync } from 'node:child_process';

const FAILED = ['20261027010000_latihan_peran_review'];

for (const name of FAILED) {
  try {
    execSync(`npx prisma migrate resolve --rolled-back ${name}`, { stdio: 'inherit' });
  } catch {
    console.log(`(lewati: ${name} tidak berstatus gagal)`);
  }
}

execSync('npx prisma migrate deploy', { stdio: 'inherit' });
