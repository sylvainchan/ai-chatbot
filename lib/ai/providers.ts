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
        "custom-life": wrapLanguageModel({
          model: custom.chat("custom-life"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": wrapLanguageModel({
          model: custom.title("custom-title"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
      },
      imageModels: {
        "small-model": xai.imageModel("grok-2-image"),
      },
    });
