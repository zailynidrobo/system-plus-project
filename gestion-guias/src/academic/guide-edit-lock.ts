import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { GuideEditLockRecord } from './entities/guide-edit-lock-record.entity.js';

/**
 * HE-09-HU-02 · Durante un periodo de edición inhabilitada no se crean, editan ni publican
 * guías base, no se editan versiones docentes y no se envían ni aprueban sugerencias.
 * La consulta sigue habilitada. Una sola regla para todos los servicios que escriben guías.
 */
export async function assertNoActiveEditLock(
  locks: Pick<Repository<GuideEditLockRecord>, 'find'>,
  now = new Date(),
) {
  const active = (await locks.find()).find(
    (lock) => lock.startsAt <= now && lock.endsAt > now,
  );
  if (active) {
    throw new ConflictException({
      code: 'GUIDE_EDITING_LOCKED',
      message: `La edición está inhabilitada por "${active.name}" hasta ${active.endsAt.toISOString()}. ${active.reason}`.trim(),
      lock: {
        name: active.name,
        reason: active.reason,
        endsAt: active.endsAt.toISOString(),
      },
    });
  }
}
