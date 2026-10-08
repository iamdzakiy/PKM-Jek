import type { Note, NoteTopic, Topic, MemoryScore } from '@prisma/client';
import type { NoteDTO } from '@/lib/types';

type NoteWithRelations = Note & {
  topics: (NoteTopic & { topic: Topic })[];
  memoryScore: MemoryScore | null;
};

export function toNoteDTO(n: NoteWithRelations): NoteDTO {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    type: n.type,
    updatedAt: n.updatedAt.toISOString(),
    topics: n.topics.map(({ topic }) => ({ id: topic.id, name: topic.name, isHot: topic.isHot })),
    mb: n.memoryScore?.memoryBuoyancy ?? null,
    pv: n.memoryScore?.preservationValue ?? null,
    folder: n.memoryScore?.folder ?? 'ACTIVE',
  };
}
