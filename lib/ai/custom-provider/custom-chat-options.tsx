import { z } from "zod/v4";

export type CustomChatModelId =
  // premier
  | "custom-deepseek-latest"
  // reasoning models
  | "custom-small-2506"
  | (string & {});

export const customProviderOptions = z.object({
  /**
   Whether to inject a safety prompt before all conversations.

   Defaults to `false`.
   */
  safePrompt: z.boolean().optional(),

  documentImageLimit: z.number().optional(),
  documentPageLimit: z.number().optional(),
});

export type CustomProviderOptions = z.infer<typeof customProviderOptions>;
