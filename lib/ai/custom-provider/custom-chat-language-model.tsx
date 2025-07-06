// CustomChatLanguageModel

import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2ResponseMetadata,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2Headers,
  SharedV2ProviderMetadata,
} from "@ai-sdk/provider";
import { FetchFunction } from "@ai-sdk/provider-utils";
import { CustomChatModelId } from "@/lib/ai/custom-provider/custom-chat-options";

type CustomChatConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class CustomChatLanguageModel implements LanguageModelV2 {
  constructor(modelId: CustomChatModelId, config: CustomChatConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  private readonly config: CustomChatConfig;

  get provider(): string {
    return this.config.provider;
  }

  readonly specificationVersion = "v2";
  readonly modelId: CustomChatModelId;
  // todo : check if this is correct
  readonly supportedUrls: Record<string, RegExp[]> = {
    "application/pdf": [/^https:\/\/.*$/],
  };

  doGenerate(options: LanguageModelV2CallOptions): PromiseLike<{
    content: Array<LanguageModelV2Content>;
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata?: SharedV2ProviderMetadata;
    request?: { body?: unknown };
    response?: LanguageModelV2ResponseMetadata & {
      headers?: SharedV2Headers;
      body?: unknown;
    };
    warnings: Array<LanguageModelV2CallWarning>;
  }> {
    throw new Error("Method not implemented.");
  }

  doStream(options: LanguageModelV2CallOptions): PromiseLike<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    request?: { body?: unknown };
    response?: { headers?: SharedV2Headers };
  }> {
    throw new Error("Method not implemented.");
  }
}
