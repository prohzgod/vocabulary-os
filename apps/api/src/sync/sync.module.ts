import { Body, Controller, HttpCode, Injectable, Module, Post } from "@nestjs/common";
import { shouldAcceptIncoming, syncRequestSchema, type SyncRequest, type SyncResponse, type User } from "@vocab-os/shared";
import { toCard, toRow } from "../cards/card.mapper";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma/prisma.module";

/**
 * Re-send anything written within this window before the cursor. It covers
 * writes that committed while a previous pull was reading. Re-sent cards are
 * harmless because clients merge by `updatedAt`.
 */
const CURSOR_OVERLAP_MS = 60_000;

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(userId: string, { cursor, changes }: SyncRequest): Promise<SyncResponse> {
    const pushedIds = changes.map((card) => card.id);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.card.findMany({ where: { userId, id: { in: pushedIds } } });
      const byId = new Map(existing.map((row) => [row.id, toCard(row)]));
      for (const card of changes) {
        if (shouldAcceptIncoming(byId.get(card.id), card)) {
          const data = toRow(userId, card);
          await tx.card.upsert({ where: { userId_id: { userId, id: card.id } }, create: data, update: data });
        }
      }
    });

    const readStartedAt = new Date();
    const changedSince = cursor
      ? { syncedAt: { gt: new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS) } }
      : { deletedAt: null }; // First sync: everything alive, no tombstones.
    const rows = await this.prisma.card.findMany({
      where: { userId, OR: [changedSince, { id: { in: pushedIds } }] }
    });

    return { cursor: readStartedAt.toISOString(), changes: rows.map(toCard) };
  }
}

@Controller("sync")
class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(200)
  sync(@CurrentUser() user: User, @Body(new ZodPipe(syncRequestSchema)) body: SyncRequest) {
    return this.syncService.sync(user.id, body);
  }
}

@Module({
  controllers: [SyncController],
  providers: [SyncService]
})
export class SyncModule {}
