import { ImageResponse } from "next/og";
import { SetoStoreMark } from "@/lib/setostore-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<SetoStoreMark size={512} rounded={false} />, { ...size });
}
