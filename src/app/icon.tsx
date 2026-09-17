import { ImageResponse } from "next/og";
import { SetoStoreMark } from "@/lib/setostore-mark";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<SetoStoreMark size={192} />, { ...size });
}
