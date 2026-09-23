import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  applyPatch,
  cardId,
  computeStats,
  createCard,
  gradeCard,
  isValidTimeZone,
  markDeleted,
  type Card,
  type CardPatch,
  type Grade,
  type NewCardInput,
  type Stats
} from "@vocab-os/shared";
import { PrismaService } from "../prisma/prisma.module";
import { toCard, toRow } from "./card.mapper";

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Card[]> {
    const rows = await this.prisma.card.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    return rows.map(toCard);
  }

  async due(userId: string, limit: number): Promise<Card[]> {
    const rows = await this.prisma.card.findMany({
      where: { userId, deletedAt: null, dueAt: { lte: new Date() } },
      orderBy: { dueAt: "asc" },
      take: limit
    });
    return rows.map(toCard);
  }

  async create(userId: string, input: NewCardInput): Promise<Card> {
    const id = cardId(input.word, input.targetLanguage);
    const existing = await this.prisma.card.findUnique({ where: { userId_id: { userId, id } } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException("This word is already saved");
    }
    // A previously deleted word is revived as a fresh card.
    return this.save(userId, createCard(input));
  }

  async update(userId: string, id: string, patch: CardPatch): Promise<Card> {
    return this.save(userId, applyPatch(await this.get(userId, id), patch));
  }

  async grade(userId: string, id: string, grade: Grade): Promise<Card> {
    return this.save(userId, gradeCard(await this.get(userId, id), grade));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.save(userId, markDeleted(await this.get(userId, id)));
  }

  async stats(userId: string, timeZone: string): Promise<Stats> {
    if (!isValidTimeZone(timeZone)) {
      throw new BadRequestException(`Unknown time zone: ${timeZone}`);
    }
    const rows = await this.prisma.card.findMany({ where: { userId, deletedAt: null } });
    return computeStats(rows.map(toCard), new Date(), timeZone);
  }

  private async get(userId: string, id: string): Promise<Card> {
    const row = await this.prisma.card.findUnique({ where: { userId_id: { userId, id } } });
    if (!row || row.deletedAt) {
      throw new NotFoundException("Word not found");
    }
    return toCard(row);
  }

  private async save(userId: string, card: Card): Promise<Card> {
    const data = toRow(userId, card);
    const row = await this.prisma.card.upsert({
      where: { userId_id: { userId, id: card.id } },
      create: data,
      update: data
    });
    return toCard(row);
  }
}
