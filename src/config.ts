import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config();

const configSchema = z.object({
  PORT: z.string().default("3001").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string(),
  MANTLE_RPC_URL: z.string().default("https://rpc.mantle.xyz"),
  MANTLE_TESTNET_RPC_URL: z.string().default("https://rpc.sepolia.mantle.xyz"),
  BACKEND_WALLET_PRIVATE_KEY: z.string().optional(),
  FACTORY_CONTRACT_ADDRESS: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  // Email (Gmail SMTP via Nodemailer) — no business account/verification needed,
  // just a Gmail address + an "App Password" (Google Account → Security → App Passwords)
  EMAIL_USER: z.string().email().optional(),
  EMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("DeathSwitch"),
  ADMIN_EMAIL: z.string().email().default("admin@deathswitch.xyz"),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
