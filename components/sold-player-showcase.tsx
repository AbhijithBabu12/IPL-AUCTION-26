"use client";

import { useMemo, useState } from "react";

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

  const selectedItem =
    orderedItems.find((item) => item.id === selectedId) ?? orderedItems[0] ?? null;

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

      <div className="sold-showcase-marquee">
        <div className="sold-showcase-track">
          {Array.from({ length: 3 }).flatMap((_, loopIndex) =>
            orderedItems.map((item) => (
              <button
                className={`sold-showcase-item${selectedItem?.id === item.id ? " active" : ""}`}
                key={`${item.id}-${loopIndex}`}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <span className="sold-showcase-badge">SOLD</span>
                <strong>{item.playerName}</strong>
                <span className="subtle">{item.teamCode}</span>
                <span className="sold-showcase-price">{formatCurrencyShort(item.amount)}</span>
              </button>
            )),
          )}
        </div>
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
