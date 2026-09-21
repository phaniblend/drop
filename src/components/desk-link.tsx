import Link from "next/link";
import type { ComponentProps } from "react";

export function DeskLink({ prefetch: _prefetch, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />;
}
