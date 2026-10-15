import { ScanSearch } from "lucide-react";
import { APP_NAME } from "@/shared/brand";
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
      aria-label={`${APP_NAME.replace("//", " ")} — Trang chủ`}
    >
      <ScanSearch size={small ? 24 : 29} strokeWidth={1.5} />
      <span>
        {APP_NAME.split("//")[0]}
        <span className="brand-slash">//</span>
        {APP_NAME.split("//")[1]}
      </span>
    </a>
  );
}
