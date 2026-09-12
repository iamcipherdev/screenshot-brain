// ─── Inline SVG icon set (lucide-inspired, stroke 1.8) ────────────────────

import React from 'react';

const P: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
  brain: <><path d="M9.5 3.5A2.5 2.5 0 0 0 7 6v.4A3 3 0 0 0 4.5 9.3a3 3 0 0 0-.9 5.2A3.1 3.1 0 0 0 6 19.6c.4 1 1.4 1.7 2.5 1.7 1.4 0 2.5-1.1 2.5-2.5V5.9c0-1.3-1-2.4-1.5-2.4Z" /><path d="M14.5 3.5A2.5 2.5 0 0 1 17 6v.4a3 3 0 0 1 2.5 2.9 3 3 0 0 1 .9 5.2A3.1 3.1 0 0 1 18 19.6c-.4 1-1.4 1.7-2.5 1.7-1.4 0-2.5-1.1-2.5-2.5V5.9c0-1.3 1-2.4 1.5-2.4Z" /></>,
  broom: <><path d="m19 4-7.5 7.5" /><path d="M13.5 5.5 18.5 10.5" /><path d="M11.5 11.5 6.7 16.3a4 4 0 0 0-1.2 2.9V21h1.8a4 4 0 0 0 2.9-1.2l4.8-4.8" /><path d="m9 15 3 3" /></>,
  library: <><rect x="3" y="4" width="7" height="17" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  x: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  check: <path d="m5 13 4 4L19 7" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m5 19 5.2-5.2a1.4 1.4 0 0 1 2 0L19 20.4" /></>,
  images: <><rect x="6" y="6" width="15" height="13" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h11" /><circle cx="11" cy="11" r="1.6" /><path d="m8 19 4-4a1.3 1.3 0 0 1 1.9 0L18 19" /></>,
  folder: <path d="M3.5 6.5A2 2 0 0 1 5.5 4.5h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />,
  share: <><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6" /></>,
  heart: <path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.4 3.6 4.5 6.6 4.5c2 0 3.6 1.1 5.4 3.2 1.8-2.1 3.4-3.2 5.4-3.2 3 0 5.1 2.9 3.9 6.2C19.5 15.4 12 20 12 20Z" />,
  tag: <><path d="m3.5 12.5 8-8H20v8.5l-8 8a1.7 1.7 0 0 1-2.4 0l-6.1-6.1a1.7 1.7 0 0 1 0-2.4Z" /><circle cx="15.5" cy="8.5" r="1.4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3.5 10.5h17" /></>,
  phone: <path d="M5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L16 14l4 1.5V19a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  link: <><path d="M10 14a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7-7L11 6" /><path d="M14 10a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7 7L13 18" /></>,
  pin: <><path d="M12 21s-6.5-5.4-6.5-10.3a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4.5 7.5 7.5 4 7.5-4" /><path d="M12 11.5V21" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4" /><circle cx="12" cy="16.8" r=".4" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 3.5V7h-3.5" /></>,
  scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
  chat: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4a.8.8 0 0 1-1.3-.6Z" />,
  send: <><path d="M4.5 11.5 20 4l-5.5 16-3.2-6.8Z" /><path d="m11.3 13.2 4.4-4.7" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5V4.5" /><path d="M12 19.5v2" /><path d="M4.9 4.9l1.4 1.4" /><path d="M17.7 17.7l1.4 1.4" /><path d="M2.5 12h2" /><path d="M19.5 12h2" /><path d="M4.9 19.1l1.4-1.4" /><path d="M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  shield: <path d="M12 3 5 5.8v5.4c0 4.6 3 8.1 7 9.8 4-1.7 7-5.2 7-9.8V5.8Z" />,
  key: <><circle cx="8" cy="14.5" r="4" /><path d="m11 11.5 8-8" /><path d="m16 4.5 3 3" /><path d="m13.5 7 3 3" /></>,
  trash: <><path d="M4.5 6.5h15" /><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" /><path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" /><path d="M10 10.5v6.5" /><path d="M14 10.5v6.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m4.5 12.8 7.5 4.2 7.5-4.2" /><path d="m4.5 16.8 7.5 4.2 7.5-4.2" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".4" /></>,
  zap: <path d="M13 3 5 13.5h6L11 21l8-10.5h-6Z" />,
  text: <><path d="M5 6h14" /><path d="M5 11h14" /><path d="M5 16h8" /></>,
  sparkles: <><path d="M12 4.5 13.8 9l4.7 1.8-4.7 1.8L12 17l-1.8-4.4L5.5 10.8 10.2 9Z" /><path d="M19 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" /><path d="M5 3l.7 1.6L7.3 5.3 5.7 6 5 7.6 4.3 6l-1.6-.7L4.3 4.6Z" /></>,
  wifiOff: <><path d="m2 2 20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 13a9.5 9.5 0 0 1 4-2.4" /><path d="M15.5 10.7A9.5 9.5 0 0 1 19 13" /><path d="M2 8.8A14.4 14.4 0 0 1 7 6" /><path d="M17.5 6a14.4 14.4 0 0 1 4.5 2.8" /><circle cx="12" cy="20" r=".8" /></>,
  keyOff: <><path d="m3 3 18 18" /><path d="M10.6 6.1A8.6 8.6 0 0 1 12 6c4.5 0 8.4 3 10 6a13.2 13.2 0 0 1-2.4 3.1" /><path d="M6.6 6.6A13 13 0 0 0 2 12c1.6 3 5.5 6 10 6a10 10 0 0 0 4.2-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  checkSquare: <><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="m8.5 12 2.5 2.5 5-5" /></>,
  square: <rect x="4" y="4" width="16" height="16" rx="2.5" />,
  more: <><circle cx="12" cy="5.5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="18.5" r="1.2" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" /></>,
  edit: <><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17Z" /><path d="m14.5 8.5 3 3" /></>,
  swap: <><path d="M7 8h13" /><path d="m17 4.5 3.5 3.5L17 11.5" /><path d="M17 16H4" /><path d="M7 12.5 3.5 16 7 19.5" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, strokeWidth = 1.8, className }: {
  name: IconName; size?: number; strokeWidth?: number; className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
