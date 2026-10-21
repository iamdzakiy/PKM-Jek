import { PrismaClient } from '@prisma/client';

// Standard Next.js singleton pattern so hot-reload in dev doesn't exhaust
// the Supabase connection pool with a new PrismaClient per request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
