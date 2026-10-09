export function SortdAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#143503" />
      <text
        x="6"
        y="22.5"
        fill="#fff2e6"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="18"
        fontWeight="700"
      >
        S
      </text>
      <rect x="22" y="19" width="4.2" height="4.2" fill="#e23b32" />
    </svg>
  );
}
