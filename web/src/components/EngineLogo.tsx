import type { Engine } from "@/lib/config";

export const ENGINE_META: Record<Engine, { label: string; color: string }> = {
  claude: { label: "Claude", color: "#da7756" },
  gemini: { label: "Gemini", color: "#4285f4" },
  chatgpt: { label: "ChatGPT", color: "#10a37f" },
  perplexity: { label: "Perplexity", color: "#1a7f64" },
};

export function engineLabel(engine: string | null | undefined): string {
  if (!engine) return "";
  return ENGINE_META[engine as Engine]?.label ?? engine;
}

function ClaudeLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#da7756" aria-hidden>
      <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
    </svg>
  );
}

function GeminiLogo({ size, idSuffix }: { size: number; idSuffix: string }) {
  const gradientId = `gemini-${idSuffix}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 4C24 15.05 15.05 24 4 24c11.05 0 20 8.95 20 20 0-11.05 8.95-20 20-20-11.05 0-20-8.95-20-20z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285f4" />
          <stop offset="0.5" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function OpenAILogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M41.2 20.3a10.7 10.7 0 00-.9-8.8 10.8 10.8 0 00-11.6-5.2A10.8 10.8 0 0020.6 2a10.7 10.7 0 00-10.2 7.4 10.7 10.7 0 00-7.2 5.2 10.8 10.8 0 001.3 12.6 10.7 10.7 0 00.9 8.8 10.8 10.8 0 0011.6 5.2A10.8 10.8 0 0027.4 46a10.7 10.7 0 0010.2-7.4 10.7 10.7 0 007.2-5.2 10.8 10.8 0 00-1.3-12.6l-2.3-.5zM27.4 43.4a8 8 0 01-5.2-1.9l.3-.1 8.5-4.9a1.4 1.4 0 00.7-1.2V22.7l3.6 2.1v12.6a8.1 8.1 0 01-7.9 6zM8.4 35.5a8 8 0 01-1-5.4l.3.2 8.5 4.9a1.4 1.4 0 001.4 0l10.4-6v4.1l-8.6 5a8.1 8.1 0 01-11-2.8zM6.2 16a8 8 0 014.2-3.5v10.1a1.4 1.4 0 00.7 1.2l10.4 6-3.6 2.1L9.4 27a8.1 8.1 0 01-3.2-11zm28.2 6.6L24 16.5l3.6-2.1 8.5 4.9a8.1 8.1 0 011.2 13.3V22.5a1.4 1.4 0 00-.7-1.2l-2.2.3zm3.5-5.5l-.3-.2-8.5-4.9a1.4 1.4 0 00-1.4 0l-10.4 6V14l8.6-5a8.1 8.1 0 0112 7.1zm-22.5 7.4l-3.6-2.1V10.9a8.1 8.1 0 0113.2-6.3l-.3.2-8.5 4.9a1.4 1.4 0 00-.7 1.2l-.1 12.6zm2-4.2l4.6-2.7 4.6 2.7v5.3l-4.6 2.7-4.6-2.7v-5.3z"
        fill="#10a37f"
      />
    </svg>
  );
}

function PerplexityLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2L18 8v3h-3V8.5L12 6.8 9 8.5V11H6V8l6-3.8zM9 13v3.5l3 1.8 3-1.8V13h3v5l-6 3.8L6 18v-5h3z"
        fill="#1a7f64"
      />
    </svg>
  );
}

export function EngineLogo({
  engine,
  size = 18,
  idSuffix = "d",
}: {
  engine: Engine | string;
  size?: number;
  idSuffix?: string;
}) {
  switch (engine) {
    case "claude":
      return <ClaudeLogo size={size} />;
    case "gemini":
      return <GeminiLogo size={size} idSuffix={idSuffix} />;
    case "chatgpt":
      return <OpenAILogo size={size} />;
    case "perplexity":
      return <PerplexityLogo size={size} />;
    default:
      return null;
  }
}
