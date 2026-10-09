"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useEffect, useState, type CSSProperties } from "react";

function ConfettiBurst() {
  const pieces = Array.from({ length: 28 }, (_, index) => index);
  return (
    <div className="order-celebrate-confetti" aria-hidden>
      {pieces.map((piece) => (
        <span key={piece} style={{ "--i": piece } as CSSProperties} />
      ))}
    </div>
  );
}

export function OrderSuccessCelebrate({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="order-celebrate" role="status" aria-live="polite">
      <ConfettiBurst />
      <div className="order-celebrate-card">
        <CheckCircle size={56} weight="fill" className="order-celebrate-icon" aria-hidden />
        <p className="order-celebrate-title">Order placed!</p>
        <p className="order-celebrate-copy">Thanks for shopping with Sortd.</p>
      </div>
    </div>
  );
}
