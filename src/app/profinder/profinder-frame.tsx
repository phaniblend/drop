"use client";

export function ProfinderFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Profinder"
      srcDoc={html}
      className="block h-[100dvh] w-full border-0 bg-[#090d16]"
    />
  );
}
