import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetaLLM — Claude vs. Gemini vs. ChatGPT vs. Perplexity",
  description: "Multi-AI arbitration — query Claude, Gemini, ChatGPT, and Perplexity, then let an arbiter choose the best.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
