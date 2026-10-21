import { PageHeader } from '@/components/pkm/page-header';
import { EngineLab } from '@/components/pkm/engine-lab';

export const metadata = { title: 'Pembobotan' };

export default function EnginePage() {
  return (
    <>
      <PageHeader
        title="Pembobotan"
        description="Dua skor menentukan apa yang tetap terlihat dan apa yang tenggelam. Mainkan parameternya dan lihat catatan contoh berpindah folder."
      />
      <EngineLab />
    </>
  );
}
