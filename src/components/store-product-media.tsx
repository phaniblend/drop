"use client";

import { useState } from "react";
import { Thumb } from "./thumb";

export function StoreProductMedia({
  title,
  imageUrl,
  gallery: galleryProp = [],
  variants,
  priority = false,
}: {
  title: string;
  imageUrl: string | null;
  gallery?: string[];
  variants: Array<{ id: string; imageUrl?: string | null }>;
  priority?: boolean;
}) {
  const extras = [
    ...galleryProp,
    ...variants.map((variant) => variant.imageUrl).filter(Boolean),
  ] as string[];
  const gallery = [imageUrl, ...extras.filter((src) => src && src !== imageUrl)].filter(Boolean) as string[];
  const [active, setActive] = useState(gallery[0] ?? "");

  return (
    <div className="space-y-3">
      <Thumb
        src={active || imageUrl}
        alt={title}
        priority={priority}
        className="aspect-square w-full rounded-2xl sm:h-80 sm:aspect-auto"
      />
      {gallery.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {gallery.slice(0, 6).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(src)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                active === src ? "border-accent" : "border-line"
              }`}
            >
              <Thumb src={src} alt="" className="h-16 w-16 rounded-none" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
