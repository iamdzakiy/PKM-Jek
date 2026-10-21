import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createHabit } from '@/app/actions/adhd';
import { PageHeader } from '@/components/pkm/page-header';
import { HabitCard, type HabitDTO } from '@/components/pkm/habit-card';
import { EmptyState } from '@/components/pkm/empty-state';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { Repeat } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Habit' };

export default async function HabitsPage() {
  const user = await requireUser();
  const today = dayAsDate(jakartaDay());
  const since = new Date(today.getTime() - 6 * 86_400_000);
  const habits = await prisma.habit.findMany({
    where: { userId: user.id, archived: false },
    include: { logs: { where: { date: { gte: since } } } },
    orderBy: { createdAt: 'asc' },
  });

  const dto: HabitDTO[] = habits.map((h) => {
    const todayLog = h.logs.find((l) => l.date.getTime() === today.getTime());
    return {
      id: h.id,
      name: h.name,
      anchorTrigger: h.anchorTrigger,
      firstSteps: h.firstSteps ?? [],
      variants: h.variants ?? [],
      stepsDone: todayLog?.stepsDone ?? 0,
      completed: todayLog?.completed ?? false,
      weekDots: Array.from({ length: 7 }, (_, i) => {
        const d = since.getTime() + i * 86_400_000;
        return h.logs.some((l) => l.date.getTime() === d && l.completed);
      }),
    };
  });

  return (
    <>
      <PageHeader title="Habit" description="Mulai dari langkah pertama saja. Satu langkah sudah dihitung." />
      <Card className="mb-6">
        <ActionForm action={createHabit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kebiasaan" htmlFor="h-name">
            <Input id="h-name" name="name" required maxLength={80} placeholder="mis. Jalan pagi" />
          </Field>
          <Field label="Kategori" htmlFor="h-cat">
            <Select id="h-cat" name="category" defaultValue="ROUTINE">
              <option value="PHYSICAL">Fisik</option>
              <option value="MENTAL">Mental</option>
              <option value="REFLECTIVE">Reflektif</option>
              <option value="ROUTINE">Rutinitas</option>
            </Select>
          </Field>
          <Field label="Dipasang setelah (opsional)" htmlFor="h-anchor" hint="Habit stacking, mis. minum kopi pagi">
            <Input id="h-anchor" name="anchorTrigger" maxLength={100} />
          </Field>
          <Field label="Format bergantian (opsional)" htmlFor="h-var" hint="Pisahkan dengan koma, supaya tidak bosan">
            <Input id="h-var" name="variants" placeholder="jalan, sepeda, yoga" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Tambah kebiasaan</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      {dto.length === 0 ? (
        <EmptyState icon={Repeat} title="Belum ada kebiasaan" description="Tambahkan satu yang kecil. Tiga langkah pertamanya dibuatkan otomatis." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{dto.map((h) => <HabitCard key={h.id} habit={h} />)}</ul>
      )}
    </>
  );
}
