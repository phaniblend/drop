"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { absoluteImageUrl } from "@/lib/image-url";

function useNextImage(src: string) {
  try {
    const host = new URL(src).hostname;
    return host === "images.unsplash.com" || host.endsWith("googleusercontent.com");
  } catch {
    return false;
  }
}

export function Thumb({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const url = absoluteImageUrl(src);
  const [failed, setFailed] = useState(false);
  const show = Boolean(url) && !failed;

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {show ? (
        useNextImage(url) ? (
          <Image
            src={url}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 280px"
            onError={() => setFailed(true)}
          />
        ) : (
          // Supplier CDNs (AliExpress etc.) often block hotlinks without a blank referrer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(145deg,#eef1f6,#f8f9fc)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">No photo</span>
        </div>
      )}
    </div>
  );
}
