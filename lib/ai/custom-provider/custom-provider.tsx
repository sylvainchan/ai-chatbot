import {
  FetchFunction,
  generateId,
  loadApiKey,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";
import { CustomChatLanguageModel } from "./custom-chat-language-model";
import { CustomChatModelId } from "./custom-chat-options";
import {
  EmbeddingModelV2,
  LanguageModelV2,
  NoSuchModelError,
  ProviderV2,
} from "@ai-sdk/provider";
import { CustomEmbeddingModelId } from "@/lib/ai/custom-provider/custom-embedding-options";
import { CustomEmbeddingModel } from "@/lib/ai/custom-provider/custom-embedding-model";

// model factory function with additional methods and properties
export interface CustomProvider extends ProviderV2 {
  (modelId: CustomChatModelId): LanguageModelV2;

  /**
   Creates a model for text generation.
   */
  languageModel(modelId: CustomChatModelId): LanguageModelV2;

  /**
   Creates a model for text generation.
   */
  chat(modelId: CustomChatModelId): LanguageModelV2;

  /**
   Creates a model for text generation.
   */
  title(modelId: CustomChatModelId): LanguageModelV2;

  /**
   @deprecated Use `textEmbeddingModel()` instead.
   */
  embedding(modelId: CustomEmbeddingModelId): EmbeddingModelV2<string>;

  /**
   @deprecated Use `textEmbeddingModel()` instead.
   */
  textEmbedding(modelId: CustomEmbeddingModelId): EmbeddingModelV2<string>;

  textEmbeddingModel: (
    modelId: CustomEmbeddingModelId,
  ) => EmbeddingModelV2<string>;
}

// todo : section!!!
export interface CustomProviderSettings {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: FetchFunction;
}

// todo : section!!!
/**
 Create a Mistral AI provider instance.
 */
export function createCustom(
  options: CustomProviderSettings = {},
): CustomProvider {
  // const baseURL =
  //   withoutTrailingSlash(options.baseURL) ?? "http://127.0.0.1:8000"; // fixme: default base URL
  const baseURL =
    withoutTrailingSlash("http://localhost:8000") ?? "http://localhost:8000";
  console.log("Creating Custom model with base URL:", baseURL);

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "CUSTOM_API_KEY",
      description: "Custom API Key",
    })}`,
    ...options.headers,
  });

  const createChatModel = (modelId: CustomChatModelId) =>
    new CustomChatLanguageModel(modelId, {
      provider: "custom.chat",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const createEmbeddingModel = (modelId: CustomEmbeddingModelId) =>
    new CustomEmbeddingModel(modelId, {
      provider: "custom.embedding",
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: CustomChatModelId) {
    if (new.target) {
      throw new Error(
        "The Custom model function cannot be called with the new keyword.",
      );
    }

    return createChatModel(modelId);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.title = createChatModel;
  provider.embedding = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "imageModel" });
  };

  return provider;
}

/**
 Default Mistral provider instance.
 */
export const custom = createCustom();
