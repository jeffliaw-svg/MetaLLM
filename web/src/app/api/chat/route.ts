import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { Engine } from "@/lib/config";

export const maxDuration = 120;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  engine: Engine;
  model: string;
  messages: ChatMessage[];
}

const anthropic = new Anthropic();
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });
const openai = new OpenAI();

async function chatClaude(model: string, messages: ChatMessage[]): Promise<string> {
  const result = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });
  return result.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
}

async function chatGemini(model: string, messages: ChatMessage[]): Promise<string> {
  const isThinkingModel = model.includes("2.5");
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const result = await genai.models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: isThinkingModel ? 1628 : 1500,
      ...(isThinkingModel && {
        thinkingConfig: { thinkingBudget: 128 },
      }),
      tools: [{ googleSearch: {} }],
    },
  });
  return result.text ?? "";
}

async function chatChatGPT(model: string, messages: ChatMessage[]): Promise<string> {
  const input = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const result = await openai.responses.create({
    model,
    input,
    tools: [{ type: "web_search_preview" }],
    max_output_tokens: 1500,
  });
  return result.output_text ?? "";
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.messages?.length) {
      return NextResponse.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    let text: string;
    switch (body.engine) {
      case "claude":
        text = await chatClaude(body.model, body.messages);
        break;
      case "gemini":
        text = await chatGemini(body.model, body.messages);
        break;
      case "chatgpt":
        text = await chatChatGPT(body.model, body.messages);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid engine." },
          { status: 400 }
        );
    }

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("Chat error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
