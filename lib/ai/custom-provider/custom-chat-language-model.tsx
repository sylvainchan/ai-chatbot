import {
  LanguageModelV2,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  FetchFunction,
  parseProviderOptions,
  ParseResult,
  postJsonToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
import { convertToCustomChatMessages } from "./convert-to-custom-chat-messages";
import { getResponseMetadata } from "./get-response-metadata";
import { mapCustomFinishReason } from "./map-custom-finish-reason";
import {
  CustomChatModelId,
  CustomProviderOptions,
  customProviderOptions,
} from "./custom-chat-options";
import { customFailedResponseHandler } from "./custom-error";
import { prepareTools } from "./custom-prepare-tools";
import { list } from "postcss";

type CustomChatConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class CustomChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";

  readonly modelId: CustomChatModelId;

  private readonly config: CustomChatConfig;

  constructor(modelId: CustomChatModelId, config: CustomChatConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    "application/pdf": [/^https:\/\/.*$/],
  };

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    providerOptions,
    tools,
    toolChoice,
  }: Parameters<LanguageModelV2["doGenerate"]>[0]) {
    const warnings: LanguageModelV2CallWarning[] = [];

    const options: CustomProviderOptions | {} =
      (await parseProviderOptions({
        provider: "custom",
        providerOptions,
        schema: customProviderOptions,
      })) ?? {};

    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK",
      });
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
      });
    }

    if (stopSequences != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences",
      });
    }

    if (
      responseFormat != null &&
      responseFormat.type === "json" &&
      responseFormat.schema != null
    ) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is not supported",
      });
    }

    const baseArgs = {
      // model id:
      model: this.modelId,

      // model specific settings:
      // @ts-ignore
      safe_prompt: options.safePrompt,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      random_seed: seed,

      // response format:
      response_format:
        responseFormat?.type === "json" ? { type: "json_object" } : undefined,

      // mistral-specific provider options:
      // @ts-ignore
      document_image_limit: options.documentPageLimit,
      // @ts-ignore
      document_page_limit: options.documentPageLimit,

      // messages:
      messages: convertToCustomChatMessages(prompt),
    };

    const {
      tools: customTools,
      toolChoice: customToolChoice,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });

    return {
      args: {
        ...baseArgs,
        tools: customTools,
        tool_choice: customToolChoice,
      },
      warnings: [...warnings, ...toolWarnings],
    };
  }

  async doGenerate(
    options: Parameters<LanguageModelV2["doGenerate"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const { args: body, warnings } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: customFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        // @ts-ignore
        customChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // @ts-ignore
    const choice = response.choices[0];
    const content: Array<LanguageModelV2Content> = [];

    // text content:
    let text = extractTextContent(choice.message.content);

    // when there is a trailing assistant message, mistral will send the
    // content of that message again. we skip this repeated content to
    // avoid duplication, e.g. in continuation mode.
    const lastMessage = body.messages[body.messages.length - 1];
    if (
      lastMessage.role === "assistant" &&
      text?.startsWith(lastMessage.content)
    ) {
      text = text.slice(lastMessage.content.length);
    }

    if (text != null && text.length > 0) {
      content.push({ type: "text", text });
    }

    // tool calls:
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool-call",
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments!,
        });
      }
    }

    return {
      content,
      finishReason: mapCustomFinishReason(choice.finish_reason),
      usage: {
        // @ts-ignore
        inputTokens: response.usage.prompt_tokens,
        // @ts-ignore
        outputTokens: response.usage.completion_tokens,
        // @ts-ignore
        totalTokens: response.usage.total_tokens,
      },
      request: { body },
      response: {
        // @ts-ignore
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
    };
  }

  async doStream(
    options: Parameters<LanguageModelV2["doStream"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const { args, warnings } = await this.getArgs(options);
    const body = { ...args, stream: true };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: customFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        // @ts-ignore
        customChatChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV2FinishReason = "unknown";
    const usage: LanguageModelV2Usage = {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    };

    let isFirstChunk = true;
    let activeText = false;

    let toolCallsActive = false;
    let toolcalls: {
      id: string | null | undefined;
      function:
        | {
            name: string | null | undefined;
            arguments: string | null | undefined;
          }
        | null
        | undefined;
    }[] = [];

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof customChatChunkSchema>>,
          LanguageModelV2StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },

          transform(chunk, controller) {
            // Emit raw chunk if requested (before anything else)
            if (options.includeRawChunks) {
              if (chunk.success) {
                controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
              }
            }

            if (!chunk.success) {
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }

            const value = chunk.value;

            if (isFirstChunk) {
              isFirstChunk = false;

              controller.enqueue({
                type: "response-metadata",
                // @ts-ignore
                ...getResponseMetadata(value),
              });
            }

            // @ts-ignore
            if (value.usage != null) {
              // @ts-ignore
              usage.inputTokens = value.usage.prompt_tokens;
              // @ts-ignore
              usage.outputTokens = value.usage.completion_tokens;
              // @ts-ignore
              usage.totalTokens = value.usage.total_tokens;
            }

            // @ts-ignore
            const choice = value.choices[0];
            const delta = choice.delta;

            const textContent = extractTextContent(delta.content);

            if (textContent != null && textContent.length > 0) {
              if (!activeText) {
                controller.enqueue({ type: "text-start", id: "0" });
                activeText = true;
              }

              controller.enqueue({
                type: "text-delta",
                id: "0",
                delta: textContent,
              });
            }

            if (delta?.tool_calls != null) {
              toolCallsActive = true;

              for (const toolCall of delta.tool_calls) {
                const toolCallId = toolCall.id;
                if (toolCallId === null || toolCallId === undefined) {
                  continue; // skip tool calls without an ID
                }
                const toolName = toolCall.function.name;
                const input = toolCall.function.arguments;

                let existingToolCalls = toolcalls.find(
                  (x) => x.id == toolCallId,
                );

                if (existingToolCalls == null) {
                  toolcalls.push({
                    id: toolCallId,
                    function: { name: toolName, arguments: input },
                  });
                } else {
                  let existingToolCallName =
                    existingToolCalls.function?.name ?? "";

                  let existingToolCallArgs =
                    existingToolCalls.function?.arguments ?? "";

                  existingToolCalls.function = {
                    name: existingToolCallName + (toolName ?? ""),
                    arguments: existingToolCallArgs + (input ?? ""),
                  };
                }

                controller.enqueue({
                  type: "tool-input-start",
                  id: toolCallId ?? "",
                  toolName: toolName ?? "",
                });

                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCallId ?? "",
                  delta: input ?? "",
                });
              }
            } else {
              if (toolCallsActive) {
                toolCallsActive = false;

                let uniqueCalls = toolcalls.filter(function (item, pos, self) {
                  return self.indexOf(item) == pos;
                });

                console.log(
                  "tool calls before filter:",
                  toolcalls,
                  "after filter:",
                  uniqueCalls,
                );

                for (const toolCall of uniqueCalls) {
                  const toolCallId = toolCall.id;
                  const toolName = toolCall.function?.name;
                  const input = toolCall.function?.arguments;

                  if (toolCallId == null || toolName == null || input == null) {
                    continue;
                  }

                  console.log("tool is calling", toolCallId, toolName, input);

                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCallId,
                  });

                  controller.enqueue({
                    type: "tool-call",
                    toolCallId,
                    toolName,
                    input,
                  });
                }
              }
            }

            if (choice.finish_reason != null) {
              console.log("finish reason", choice.finish_reason);
              finishReason = mapCustomFinishReason(choice.finish_reason);
            }
          },

          flush(controller) {
            if (activeText) {
              console.log("ending text stream");
              controller.enqueue({ type: "text-end", id: "0" });
            }

            console.log("end text stream with reason: ", finishReason, usage);

            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}

function extractTextContent(content: z.infer<typeof customContentSchema>) {
  if (typeof content === "string") {
    return content;
  }

  if (content == null) {
    return undefined;
  }

  const textContent: string[] = [];

  for (const chunk of content) {
    const { type } = chunk;

    switch (type) {
      case "text":
        textContent.push(chunk.text);
        break;
      case "image_url":
      case "reference":
        // image content or reference content is currently ignored.
        break;
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }

  return textContent.length ? textContent.join("") : undefined;
}

const customContentSchema = z
  .union([
    z.string(),
    z.array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("text"),
          text: z.string(),
        }),
        z.object({
          type: z.literal("image_url"),
          image_url: z.union([
            z.string(),
            z.object({
              url: z.string(),
              detail: z.string().nullable(),
            }),
          ]),
        }),
        z.object({
          type: z.literal("reference"),
          reference_ids: z.array(z.number()),
        }),
      ]),
    ),
  ])
  .nullish();

const customUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const customChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal("assistant"),
        content: customContentSchema,
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      index: z.number(),
      finish_reason: z.string().nullish(),
    }),
  ),
  object: z.literal("chat.completion"),
  usage: customUsageSchema,
});

const customToolCallSchema = z.array(
  z.object({
    id: z.string().nullish(),
    function: z.object({
      name: z.string().nullish(),
      arguments: z.string().nullish(),
    }),
  }),
);

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const customChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.enum(["assistant"]).nullish().optional(),
        content: customContentSchema,
        tool_calls: customToolCallSchema.nullish(),
      }),
      finish_reason: z.string().nullish(),
      index: z.number(),
    }),
  ),
  usage: customUsageSchema.nullish(),
});
