import { Body, Controller, Get, HttpCode, Module, Post } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { credentialsSchema, type Credentials, type User } from "@vocab-os/shared";
import { ZodPipe } from "../common/zod.pipe";
import { config } from "../config";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./public.decorator";

/** Guessing passwords is the one thing worth rate limiting hard: 10 tries per minute per IP. */
@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Controller("auth")
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body(new ZodPipe(credentialsSchema)) body: Credentials) {
    return this.auth.register(body);
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodPipe(credentialsSchema)) body: Credentials) {
    return this.auth.login(body);
  }

  @Get("me")
  me(@CurrentUser() user: User) {
    return user;
  }
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: config.jwtSecret,
      signOptions: { expiresIn: config.jwtExpiresIn }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
