import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = "SetoStore";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: BRAND.canvas,
          color: BRAND.ink,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 88,
            height: 88,
            borderRadius: 20,
            background: BRAND.purple,
            color: "#fff",
            fontSize: 42,
            fontWeight: 700,
          }}
        >
          S
        </div>
        <div style={{ marginTop: 28, fontSize: 64, fontWeight: 700 }}>SetoStore</div>
        <div style={{ marginTop: 12, fontSize: 28, color: "#667085" }}>
          Source products. Manage suppliers. Scale faster.
        </div>
      </div>
    ),
    { ...size },
  );
}
