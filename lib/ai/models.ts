export const DEFAULT_CHAT_MODEL: string = "chat-model";

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: "custom-chat-model",
    name: "Custom Chat model",
    description: "Primary model for all-purpose chat",
  },
  {
    id: "custom-life",
    name: "Custom Life model",
    description: "Primary model for life-purpose chat",
  },
];
