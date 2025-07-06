export type CustomPrompt = Array<CustomMessage>;

export type CustomMessage =
  | CustomSystemMessage
  | CustomUserMessage
  | CustomAssistantMessage
  | CustomToolMessage;

export interface CustomSystemMessage {
  role: "system";
  content: string;
}

export interface CustomUserMessage {
  role: "user";
  content: Array<CustomUserMessageContent>;
}

export type CustomUserMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string }
  | { type: "document_url"; document_url: string };

export interface CustomAssistantMessage {
  role: "assistant";
  content: string;
  prefix?: boolean;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface CustomToolMessage {
  role: "tool";
  name: string;
  content: string;
  tool_call_id: string;
}

export type CustomToolChoice =
  | { type: "function"; function: { name: string } }
  | "auto"
  | "none"
  | "any";
