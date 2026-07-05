"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Runs before hydration (inlined in the root layout) so the first paint
// already has the right theme — no flash of the wrong palette.
export const THEME_INIT_SCRIPT = `(()=>{try{const t=localStorage.theme;if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch{}})()`;

// The <html> class is the source of truth; this tiny store lets React
// subscribe to it without state-in-effect gymnastics.
let listeners: (() => void)[] = [];
function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function darkSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, darkSnapshot, () => false);

  function toggle() {
    document.documentElement.classList.toggle("dark", !dark);
    try {
      localStorage.theme = !dark ? "dark" : "light";
    } catch {
      /* private mode — theme just won't persist */
    }
    listeners.forEach((l) => l());
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
