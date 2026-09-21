import { z } from "zod";

export const stationSchema = z.enum(["GENERAL", "KITCHEN", "BAR"]);
export const orderTransitionSchema = z.object({ targetStatus: z.enum(["PREPARING", "READY", "DELIVERED", "CANCELLED"]), expectedVersion: z.number().int().min(1), reason: z.string().trim().max(240).optional() }).strict();
export const itemTransitionSchema = z.object({ targetStatus: z.enum(["PREPARING", "READY", "DELIVERED"]), expectedOrderVersion: z.number().int().min(1) }).strict();
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;
export type ItemTransitionInput = z.infer<typeof itemTransitionSchema>;
