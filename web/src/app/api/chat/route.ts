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

let _anthropic: Anthropic | null = null;
let _genai: GoogleGenAI | null = null;
let _openai: OpenAI | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}
function getGenAI(): GoogleGenAI {
  if (!_genai) _genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });
  return _genai;
}
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

const SEARCH_INSTRUCTION =
  "\n\nYou have access to a web search tool. ALWAYS use it to find current, up-to-date information before answering. Do not rely on your training data for facts that may have changed.";

async function chatClaude(model: string, messages: ChatMessage[]): Promise<string> {
  const result = await getAnthropic().messages.create({
    model,
    max_tokens: 4096,
    system: SEARCH_INSTRUCTION.trim(),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });
  const textBlocks = result.content.filter((b) => b.type === "text");
  const text = textBlocks.map((b: any) => b.text).join("");

  // Extract web search citations
  const citations: Array<{ url: string; title: string }> = [];
  for (const block of textBlocks) {
    const b = block as any;
    if (b.citations) {
      for (const cite of b.citations) {
        if (cite.type === "web_search_result_location" && cite.url) {
          citations.push({ url: cite.url, title: cite.title ?? "" });
        }
      }
    }
  }
  const unique = [...new Map(citations.map((c) => [c.url, c])).values()];
  return unique.length > 0
    ? text + "\n\n**Sources:**\n" + unique.map((c) => `- [${c.title}](${c.url})`).join("\n")
    : text;
}

async function chatGemini(model: string, messages: ChatMessage[]): Promise<string> {
  const isThinkingModel = model.includes("2.5");
  const thinkingBudget = isThinkingModel ? 1024 : undefined;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const result = await getGenAI().models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: isThinkingModel ? 4096 + (thinkingBudget ?? 0) : 4096,
      systemInstruction: SEARCH_INSTRUCTION.replace("a web search tool", "Google Search").trim(),
      ...(isThinkingModel && {
        thinkingConfig: { thinkingBudget: thinkingBudget! },
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
  const result = await getOpenAI().responses.create({
    model,
    instructions: SEARCH_INSTRUCTION.trim(),
    input,
    tools: [{ type: "web_search_preview" }],
    max_output_tokens: 4096,
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
