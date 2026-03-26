"use client";

import { useMemo, useRef, useState } from "react";

import { formatCurrencyShort } from "@/lib/utils";

export type SoldShowcaseItem = {
  id: string;
  playerName: string;
  teamCode: string;
  teamName?: string | null;
  amount: number;
  role?: string | null;
};

export function SoldPlayerShowcase({
  items,
  title,
  variant,
}: {
  items: SoldShowcaseItem[];
  title?: string;
  variant: "ticker" | "cards";
}) {
  const orderedItems = useMemo(
    () => [...items].sort((left, right) => right.amount - left.amount || left.playerName.localeCompare(right.playerName)),
    [items],
  );
  const [selectedId, setSelectedId] = useState<string | null>(orderedItems[0]?.id ?? null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const selectedItem =
    orderedItems.find((item) => item.id === selectedId) ?? orderedItems[0] ?? null;

  function scrollByAmount(direction: "left" | "right") {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = Math.max(220, Math.floor(node.clientWidth * 0.72));
    node.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  if (orderedItems.length === 0) {
    return null;
  }

  return (
    <div className={`sold-showcase sold-showcase-${variant}`}>
      {title ? (
        <div className="sold-showcase-head">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <span className="subtle" style={{ fontSize: "0.8rem" }}>
            Highest sold prices first. Click any item for details.
          </span>
        </div>
      ) : null}

      <div className="sold-showcase-slider">
        <button
          aria-label="Scroll sold players left"
          className="sold-showcase-nav"
          onClick={() => scrollByAmount("left")}
          type="button"
        >
          ‹
        </button>
        <div className="sold-showcase-scroller" ref={scrollerRef}>
          <div className="sold-showcase-track">
            {orderedItems.map((item) => (
              <button
                className={`sold-showcase-item${selectedItem?.id === item.id ? " active" : ""}`}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <span className="sold-showcase-badge">SOLD</span>
                <strong>{item.playerName}</strong>
                <span className="subtle">{item.teamCode}</span>
                <span className="sold-showcase-price">{formatCurrencyShort(item.amount)}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          aria-label="Scroll sold players right"
          className="sold-showcase-nav"
          onClick={() => scrollByAmount("right")}
          type="button"
        >
          ›
        </button>
      </div>

      {selectedItem ? (
        <div className="sold-showcase-detail">
          <div>
            <div className="sold-showcase-detail-title">{selectedItem.playerName}</div>
            <div className="subtle" style={{ fontSize: "0.82rem" }}>
              {selectedItem.teamName ?? selectedItem.teamCode}
              {selectedItem.role ? ` • ${selectedItem.role}` : ""}
            </div>
          </div>
          <div className="sold-showcase-detail-price">
            {formatCurrencyShort(selectedItem.amount)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
