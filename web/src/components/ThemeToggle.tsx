"use client";

export function ThemeToggle() {
  const toggle = () => {
    const el = document.documentElement;
    const next = el.dataset.theme === "dark" ? "light" : "dark";
    el.dataset.theme = next;
    localStorage.setItem("theme", next);
  };
  return <button className="btn ghost" onClick={toggle} aria-label="Toggle light/dark">◐</button>;
}
