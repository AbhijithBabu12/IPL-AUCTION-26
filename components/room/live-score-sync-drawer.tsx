"use client";

import { useEffect, useState } from "react";
import { WebscrapeSyncPanel } from "@/components/room/webscrape-sync-panel";

interface LiveScoreSyncDrawerProps {
  roomCode: string;
  initialProviders?: Array<{ id: string; label: string; configured: boolean }>;
}

export function LiveScoreSyncDrawer({ roomCode, initialProviders = [] }: LiveScoreSyncDrawerProps) {
  const [open, setOpen] = useState(false);

  // Auto-open when Cricsheet sync completes
  useEffect(() => {
    function onCricsheetSynced() { setOpen(true); }
    window.addEventListener("open-live-score-sync", onCricsheetSynced);
    return () => window.removeEventListener("open-live-score-sync", onCricsheetSynced);
  }, []);

  const ACCENT = "rgba(99,220,120,0.25)";

  return (
    <>
      {/* Section-style trigger — visually matches CollapsibleSection but opens a drawer */}
      <div style={{ border: `1px solid ${ACCENT}`, borderRadius: "12px", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.9rem 1.2rem",
            background: "rgba(255,255,255,0.01)",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span className="eyebrow" style={{ fontSize: "0.72rem" }}>Fetch &amp; accept match scores</span>
          <span style={{ fontWeight: 600, fontSize: "1rem", flex: 1, color: "var(--foreground, #fff)" }}>
            Live Score Sync
          </span>
          {/* Right-arrow icon — signals "opens drawer", not expand-in-place */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.6, flexShrink: 0 }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.22s",
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-label="Live Score Sync"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          width: "min(960px, 97vw)",
          background: "#0d0b1f",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-8px 0 48px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
          background: "rgba(99,220,120,0.05)",
        }}>
          <div>
            <span className="eyebrow" style={{ fontSize: "0.7rem" }}>Fetch &amp; accept match scores</span>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Live Score Sync</h2>
          </div>
          <button
            className="button ghost"
            onClick={() => setOpen(false)}
            type="button"
            style={{ fontSize: "1.5rem", padding: "0.15rem 0.55rem", lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body — only mount WebscrapeSyncPanel when open */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {open && <WebscrapeSyncPanel roomCode={roomCode} initialProviders={initialProviders} />}
        </div>
      </div>
    </>
  );
}
