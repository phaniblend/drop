import { BRAND } from "./brand";

/** JSX for next/og ImageResponse — flex-only styles. */
export function SetoStoreMark({
  size,
  rounded = true,
}: {
  size: number;
  rounded?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.purple,
        borderRadius: rounded ? Math.round(size * 0.22) : 0,
        color: "#ffffff",
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      S
    </div>
  );
}
