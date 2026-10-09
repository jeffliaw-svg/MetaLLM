import { ImageResponse } from "next/og";

export function renderAppIcon(px: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#C96442", color: "#fff", fontSize: px * 0.6, fontWeight: 700 }}>
        M
      </div>
    ),
    { width: px, height: px },
  );
}
