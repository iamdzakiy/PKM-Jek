import { requireUser } from '@/lib/current-user';
import { Sidebar } from '@/components/pkm/sidebar';
import { TopBar } from '@/components/pkm/topbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Enforces sign-in + resolves the Prisma User row; middleware.ts already
  // blocked anyone whose email isn't ALLOWED_EMAIL before this ever runs.
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={user.email} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
