import { Layers2 } from "lucide-react";
export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Quorum home">
      <span className="brand-mark">
        <Layers2 size={23} strokeWidth={1.8} />
      </span>
      quorum<span className="brand-period">.</span>
    </button>
  );
}
