"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

export function PwaInstallButton() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const sync = () => setCanInstall(Boolean(window.__dsInstallPrompt));
    sync();
    window.addEventListener("ds-pwa-prompt", sync);
    return () => window.removeEventListener("ds-pwa-prompt", sync);
  }, []);

  if (!canInstall) return null;

  return (
    <Button
      className="mt-4"
      tone="accent"
      onClick={async () => {
        const prompt = window.__dsInstallPrompt;
        if (!prompt) return;
        await prompt.prompt();
        window.__dsInstallPrompt = undefined;
        setCanInstall(false);
      }}
    >
      Install SetoStore
    </Button>
  );
}
