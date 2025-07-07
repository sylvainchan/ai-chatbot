import { z } from "zod/v4";
import { ZodType, ZodTypeDef } from "zod";

export type CustomChatModelId =
  // premier
  | "custom-deepseek-latest"
  | "custom-life"
  | "custom-title"
  // reasoning models
  | (string & {});

export const customProviderOptions = z.object({
  /**
   Whether to inject a safety prompt before all conversations.

   Defaults to `false`.
   */
  safePrompt: z.boolean().optional(),
  documentImageLimit: z.number().optional(),
  documentPageLimit: z.number().optional(),
}) as unknown as ZodType<unknown, ZodTypeDef, unknown>;

export type CustomProviderOptions = z.infer<typeof customProviderOptions>;
