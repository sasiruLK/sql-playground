"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "sql-playground:theme";

export function ThemeToggle() {
  // Starts undefined so the button renders nothing theme-specific until we
  // have read the DOM, which the pre-paint script in the layout has set.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);

    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // A locked-down browser just loses the preference between visits.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      // Comfortable tap target on phones, tidier on desktop.
      className="size-11 sm:size-9"
      onClick={toggle}
      aria-label="Toggle dark mode"
      data-testid="theme-toggle"
    >
      {dark === null ? null : dark ? <Sun /> : <Moon />}
    </Button>
  );
}
