import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .min(1, "RAZORPAY_WEBHOOK_SECRET is required"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  CLIENT_URL: z.url("CLIENT_URL must be a valid URL").trim(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");

  for (const issue of result.error.issues) {
    console.error(`${issue.path.join(".")}: ${issue.message}`);
  }

  process.exit(1);
}

export const env = result.data;
