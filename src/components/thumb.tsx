import Image from "next/image";
import { cn } from "@/lib/utils";

export function Thumb({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized={!src.includes("images.unsplash.com")}
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 280px"
        />
      ) : null}
    </div>
  );
}
