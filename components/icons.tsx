/**
 * Grayscale tool icons — stroke-based, monochrome, 24×24 viewBox.
 * `currentColor` inherits text color from the parent.
 */

interface IconProps {
  className?: string
  size?: number
  strokeWidth?: number
}

function Icon({
  children, className, size = 24, strokeWidth = 1.75,
}: IconProps & { children: React.ReactNode }) {
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
      {children}
    </svg>
  )
}

// ── Tool icons ────────────────────────────────────────────────────────────────

export function HookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Eye at the top (the loop where fishing line ties on) */}
      <circle cx="15" cy="4" r="2" />
      {/* Shank curving down into the bend */}
      <path d="M15 6v8a5 5 0 0 1-5 5 5 5 0 0 1-5-5 3 3 0 0 1 3-3" />
      {/* Barb at the point */}
      <path d="M8 11l2 2" />
    </Icon>
  )
}

export function ClicheIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3v18" />
      <path d="M5 4h12l-3 4 3 4H5" />
    </Icon>
  )
}

export function AiCheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M9 2v4M15 2v4" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <path d="M9 16h6" />
    </Icon>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function StageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v8a8 8 0 0 1-16 0V5z" />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <path d="M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
    </Icon>
  )
}

// ── UI / nav icons ────────────────────────────────────────────────────────────

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  )
}

export function ChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  )
}

export function ArrowRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Icon>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </Icon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  )
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12l5 5L20 6" />
    </Icon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4M12 18v.01" />
    </Icon>
  )
}

// ── Brand marks ───────────────────────────────────────────────────────────────

// Feather with three AI sparkles — the FES wordmark logo
export function FeatherSparkleLogo({
  size = 32, className,
}: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 38 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M23.2 13.4 a6.2 6.2 0 0 0 -8.7 -8.7 L 7.8 11.2 V 20 h 8.8 z"
        fill="#E8EDFF"
        stroke="#0A38F5"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18.7 8.8 L 4.5 23" stroke="#0A38F5" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M20.3 15.7 H 11.2" stroke="#0A38F5" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M29 3.5 L 30.2 6.8 L 33.5 8 L 30.2 9.2 L 29 12.5 L 27.8 9.2 L 24.5 8 L 27.8 6.8 Z"
        fill="#0A38F5"
      />
      <path
        d="M32 14 L 32.5 15.5 L 34 16 L 32.5 16.5 L 32 18 L 31.5 16.5 L 30 16 L 31.5 15.5 Z"
        fill="#0A38F5"
        fillOpacity="0.55"
      />
    </svg>
  )
}

// PowerMyPrompt branded button (matches PowerMyPrompt_Button.html)
export function PmpButton({ width = 180, height = 44 }: { width?: number; height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 200 48">
      <rect width="200" height="48" rx="8" fill="#18181b" />
      <polygon fill="#ff6b2c" points="16,8 27,8 22,21 31,21 13,40 18,25 10,25" />
      <text x="36" y="31" fontFamily="ui-monospace, monospace" fontWeight="700" fontSize="14" fill="#ff6b2c">&gt;_</text>
      <line x1="60" y1="12" x2="60" y2="36" stroke="#333" strokeWidth="1" />
      <text x="70" y="22" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="13" fill="#fff" letterSpacing=".3">Power My Prompt</text>
      <text x="70" y="36" fontFamily="ui-monospace, monospace" fontWeight="600" fontSize="9" fill="#71717a" letterSpacing=".5">FUND MY COMPUTE</text>
    </svg>
  )
}
