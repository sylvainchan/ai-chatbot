import {
  EmbeddingModelV2,
  TooManyEmbeddingValuesForCallError,
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createJsonResponseHandler,
  FetchFunction,
  postJsonToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
import { CustomEmbeddingModelId } from "./custom-embedding-options";
import { customFailedResponseHandler } from "./custom-error";
import { ZodType, ZodTypeDef } from "zod";

type CustomEmbeddingConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class CustomEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = "v2";
  readonly modelId: CustomEmbeddingModelId;
  readonly maxEmbeddingsPerCall = 32;
  readonly supportsParallelCalls = false;

  private readonly config: CustomEmbeddingConfig;

  get provider(): string {
    return this.config.provider;
  }

  constructor(modelId: CustomEmbeddingModelId, config: CustomEmbeddingConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  async doEmbed({
    values,
    abortSignal,
    headers,
  }: Parameters<EmbeddingModelV2<string>["doEmbed"]>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV2<string>["doEmbed"]>>
  > {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    var resp = await postJsonToApi({
      url: `${this.config.baseURL}/embeddings`,
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
      },
      failedResponseHandler: customFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        CustomTextEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const { responseHeaders, value: response, rawValue } = resp;
    const typedResponse = response as CustomTextEmbeddingResponse;
    
    return {
      embeddings: typedResponse.data.map((item) => item.embedding),
      usage: typedResponse.usage
        ? { tokens: typedResponse.usage.prompt_tokens }
        : undefined,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}

// minimal version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const CustomTextEmbeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
  usage: z.object({ prompt_tokens: z.number() }).nullish(),
}) as unknown as ZodType<unknown, ZodTypeDef, unknown>;

interface CustomTextEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage?: { prompt_tokens: number };
}
