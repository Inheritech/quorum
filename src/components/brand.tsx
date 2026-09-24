import { Layers2 } from "lucide-react";
export function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <span className="brand-mark">
        <Layers2 size={23} strokeWidth={1.8} />
      </span>
      quorum<span className="brand-period">.</span>
    </>
  );
  return onClick ? (
    <button className="brand" onClick={onClick} aria-label="Quorum home">
      {content}
    </button>
  ) : (
    <span className="brand">{content}</span>
  );
}
