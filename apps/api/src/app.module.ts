import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { Public } from "./auth/public.decorator";
import { CardsModule } from "./cards/cards.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SyncModule } from "./sync/sync.module";

@Controller("health")
class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    // Per-IP request cap. Sign-in routes are stricter (see auth.module.ts).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    CardsModule,
    SyncModule
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route requires a signed-in user unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard }
  ]
})
export class AppModule {}
