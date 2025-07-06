import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
import { ZodType, ZodTypeDef } from "zod";

const customErrorDataSchema = z.object({
  object: z.literal("error"),
  message: z.string(),
  type: z.string(),
  param: z.string().nullable(),
  code: z.string().nullable(),
}) as unknown as ZodType<unknown, ZodTypeDef, unknown>;

export type CustomErrorData = z.infer<typeof customErrorDataSchema>;

export const customFailedResponseHandler = createJsonErrorResponseHandler({
  errorToMessage(error): string {
    return "";
  },
  errorSchema: customErrorDataSchema,
});
