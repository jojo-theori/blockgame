// The drawings behind <Icon>: 24 by 24, drawn in strokes unless marked filled.
export const PATHS = {
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />,
  check: <path d="M5.5 12.5l4.2 4.2L18.5 8" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  eraser: (
    <>
      <path d="M8 20h12M5.5 15.5l9-9a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L12 17l-3 3H7l-1.5-1.5a2 2 0 0 1 0-3Z" />
      <path d="M9.5 11.5l4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 16.9v.2" />
    </>
  ),
  prev: <path d="M14.5 6.5 9 12l5.5 5.5" />,
  next: <path d="M9.5 6.5 15 12l-5.5 5.5" />,
  // Filled shapes
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </g>
  ),
  play: <path d="M9 6.5v11l9-5.5z" fill="currentColor" stroke="none" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
};
export const ICON_NAMES = Object.keys(PATHS);
