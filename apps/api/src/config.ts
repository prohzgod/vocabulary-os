import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on real environment variables (production).
}

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    PORT: z.coerce.number().int().default(3000)
  })
  .parse(process.env);

export const config = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: "30d"
} as const;
