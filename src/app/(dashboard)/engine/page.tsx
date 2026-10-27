import { PageHeader } from '@/components/pkm/page-header';
import { EngineLab } from '@/components/pkm/engine-lab';

export const metadata = { title: 'Pembobotan' };

export default function EnginePage() {
  return (
    <>
      <PageHeader
        title="Pembobotan"
        description="Dua skor yang menentukan catatan mana tetap terlihat. Coba ubah parameternya."
      />
      <EngineLab />
    </>
  );
}
