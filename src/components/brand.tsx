import { Orbit } from "lucide-react";
export function Brand({
  small = false,
  href = "/",
}: {
  small?: boolean;
  href?: string;
}) {
  return (
    <a
      className={`brand ${small ? "small" : ""}`}
      href={href}
      aria-label="EARTH PLAY — Trang chủ"
    >
      <Orbit size={small ? 24 : 29} strokeWidth={1.3} />
      <span>
        EARTH<span className="brand-slash">//</span>PLAY
      </span>
    </a>
  );
}
