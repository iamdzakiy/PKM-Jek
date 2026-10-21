import { PageHeader } from '@/components/pkm/page-header';
import { InteroceptiveReset } from '@/components/pkm/interoceptive-reset';

export const metadata = { title: 'Reset' };

export default function ResetPage() {
  return (
    <>
      <PageHeader title="Reset" description="Kalau kepala terasa ramai. Ikuti lingkaran, tidak perlu melakukan hal lain." />
      <InteroceptiveReset />
    </>
  );
}
