import { z } from "zod";

export const createinviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid Email Address"),
});
