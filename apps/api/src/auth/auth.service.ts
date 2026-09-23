import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthResponse, Credentials, User } from "@vocab-os/shared";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.module";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register({ email, password }: Credentials): Promise<AuthResponse> {
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException("An account with this email already exists");
    }
    const user = await this.prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 10) }
    });
    return this.issue(user);
  }

  async login({ email, password }: Credentials): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.issue(user);
  }

  private async issue(user: User): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  }
}
