import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const demoLoginSchema = z.object({
  role: z.enum(["super_admin", "manager", "support_agent", "finance"]),
});

export const googleLoginSchema = z.object({
  credential: z.string().min(1),
});
