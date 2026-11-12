import type { ReactNode } from "react";

const icons = {
  notebook: (
    <>
      <path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 3v18M12 8h4M12 12h4" />
    </>
  ),
  pen: (
    <>
      <path d="m13 3 8 8-7 7-7-7 6-8Z" />
      <path d="m7 11-4 10 11-3M3 21l7-7" />
      <circle cx="11" cy="13" r="1" />
    </>
  ),
  pencil: (
    <>
      <path d="m15 4 5 5L8 21H3v-5L15 4Z" />
      <path d="m12 7 5 5M3 16l5 5" />
    </>
  ),
  highlighter: (
    <>
      <path d="m14 3 7 7-9 9-7-7 9-9Z" />
      <path d="m5 12-3 7 3 3 7-3M2 22h16" />
    </>
  ),
  eraser: (
    <>
      <path d="m14 3 7 7-10 11H7l-5-5L14 3Z" />
      <path d="m8 9 7 7M11 21h10" />
    </>
  ),
  undo: (
    <>
      <path d="M8 5 3 10l5 5" />
      <path d="M3 10h11a6 6 0 0 1 0 12" />
    </>
  ),
  redo: (
    <>
      <path d="m16 5 5 5-5 5" />
      <path d="M21 10H10a6 6 0 0 0 0 12" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" fill="var(--surface)" />
      <circle cx="15" cy="17" r="3" fill="var(--surface)" />
    </>
  ),
  page: (
    <>
      <path d="M6 3h9l4 4v14H6V3Z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  fit: (
    <>
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <rect x="8" y="7" width="8" height="10" rx="1" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof icons;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name]}
    </svg>
  );
}
