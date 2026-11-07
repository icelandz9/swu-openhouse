// CPE logo (red gear "C" with a terminal prompt + white "PE"). Made for dark backgrounds.
// Source: template/logo/cpe-logo.png, trimmed to the artwork and stored at 944x400.
// Set the size with a height class, e.g. <CpeLogo className="h-10" />.

export function CpeLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/logo/cpe-logo.png"
      alt="CPE วิศวกรรมคอมพิวเตอร์ มศว"
      width={944}
      height={400}
      draggable={false}
      className={`w-auto select-none ${className}`}
    />
  );
}
