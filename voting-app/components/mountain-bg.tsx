export function MountainBg() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] overflow-hidden">
      <div className="cv-grid absolute inset-0" />
      <svg
        viewBox="0 0 1200 420"
        className="absolute bottom-0 right-0 h-full w-full opacity-40 md:w-[72%] md:opacity-70"
        preserveAspectRatio="xMaxYMax meet"
      >
        <defs>
          <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="#9cbc9a" />
          </pattern>
        </defs>
        <path d="M0 420 L180 250 L280 310 L420 140 L540 250 L680 90 L820 220 L960 70 L1100 200 L1200 120 L1200 420 Z" fill="url(#dots)" opacity="0.35" />
        <path d="M220 420 L380 280 L500 340 L640 190 L790 300 L920 160 L1080 280 L1200 210 L1200 420 Z" fill="url(#dots)" opacity="0.55" />
        <circle cx="980" cy="118" r="26" fill="none" stroke="#9cbc9a" strokeWidth="2" opacity="0.45" />
      </svg>
    </div>
  )
}
