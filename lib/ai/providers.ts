import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { xai } from "@ai-sdk/xai";
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from "./models.test";
import { isTestEnvironment } from "../constants";
import { custom } from "@/lib/ai/custom-provider/custom-provider";

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        "chat-model": chatModel,
        "chat-model-reasoning": reasoningModel,
        "title-model": titleModel,
        "artifact-model": artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        "custom-chat-model": wrapLanguageModel({
          model: custom.chat("custom-deepseek-latest"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "chat-model": xai("grok-2-vision-1212"),
        "chat-model-reasoning": wrapLanguageModel({
          model: xai("grok-3-mini-beta"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": wrapLanguageModel({
          model: custom.title("custom-title"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),

        "artifact-model": xai("grok-2-1212"),
      },
      imageModels: {
        "small-model": xai.imageModel("grok-2-image"),
      },
    });
