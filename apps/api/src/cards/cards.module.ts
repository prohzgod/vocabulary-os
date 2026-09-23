import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from "@nestjs/common";
import { cardPatchSchema, gradeSchema, newCardSchema, type CardPatch, type NewCardInput, type User } from "@vocab-os/shared";
import type { z } from "zod";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { CardsService } from "./cards.service";

@Controller()
class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get("cards")
  list(@CurrentUser() user: User) {
    return this.cards.list(user.id);
  }

  @Get("cards/due")
  due(@CurrentUser() user: User, @Query("limit") limit?: string) {
    return this.cards.due(user.id, Math.min(Math.max(Number(limit) || 50, 1), 200));
  }

  @Post("cards")
  create(@CurrentUser() user: User, @Body(new ZodPipe(newCardSchema)) body: NewCardInput) {
    return this.cards.create(user.id, body);
  }

  @Patch("cards/:id")
  update(@CurrentUser() user: User, @Param("id") id: string, @Body(new ZodPipe(cardPatchSchema)) body: CardPatch) {
    return this.cards.update(user.id, id, body);
  }

  @Post("cards/:id/review")
  @HttpCode(200)
  review(@CurrentUser() user: User, @Param("id") id: string, @Body(new ZodPipe(gradeSchema)) body: z.infer<typeof gradeSchema>) {
    return this.cards.grade(user.id, id, body.grade);
  }

  @Delete("cards/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param("id") id: string) {
    return this.cards.remove(user.id, id);
  }

  /** `timeZone` is an IANA name such as Asia/Ho_Chi_Minh; "today" and streaks use it. */
  @Get("stats")
  stats(@CurrentUser() user: User, @Query("timeZone") timeZone = "UTC") {
    return this.cards.stats(user.id, timeZone);
  }
}

@Module({
  controllers: [CardsController],
  providers: [CardsService]
})
export class CardsModule {}
