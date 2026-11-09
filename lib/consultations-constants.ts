import { z } from "zod";

export const CONSULTATION_TYPES = [
  "viewing",
  "sizing",
  "acquisition",
  "styling",
] as const;

export const CONSULTATION_TYPE_LABEL: Record<(typeof CONSULTATION_TYPES)[number], string> = {
  viewing: "Private Showroom Viewing",
  sizing: "Custom Sizing & Engraving",
  acquisition: "Rare Piece Acquisition",
  styling: "Bridal & High-Jewelry Styling",
};

export const CONSULTATION_STATUS_LABEL = {
  NEW: "New",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
} as const;

export type ConsultationStatusValue = "NEW" | "CONTACTED" | "CLOSED";

export const CONSULTATION_TRANSITIONS: Record<ConsultationStatusValue, readonly ConsultationStatusValue[]> = {
  NEW: ["CONTACTED", "CLOSED"],
  CONTACTED: ["CLOSED", "NEW"],
  CLOSED: [],
};

export const consultationSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a phone number we can reach you on.")
    .max(24),
  type: z.enum(CONSULTATION_TYPES),
  preferredDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  productName: z.string().trim().max(160).optional().or(z.literal("")),
  productSlug: z.string().trim().max(160).optional().or(z.literal("")),
});

export type ConsultationInput = z.infer<typeof consultationSchema>;
