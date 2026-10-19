import { z } from "zod";
import { ROLES } from "../models/User.js";
import { emailSchema, passwordSchema, personNameSchema } from "./common.js";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
  remember: z.boolean().optional().default(false),
});

export const demoLoginSchema = z.object({
  role: z.enum(ROLES),
});

export const googleLoginSchema = z.object({
  credential: z.string().min(1).max(4096),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const passwordTokenSchema = z.object({
  token: z.string().min(20).max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: passwordSchema,
  })
  .refine((body) => body.currentPassword !== body.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

export const updateProfileSchema = z.object({
  name: personNameSchema,
});
