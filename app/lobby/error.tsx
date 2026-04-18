"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LobbyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell" id="main-content">
      <div className="panel" style={{ textAlign: "center", padding: "3rem 2rem" }}>
        <span className="eyebrow">Error</span>
        <h1 className="page-title" style={{ marginTop: "0.5rem" }}>Something went wrong</h1>
        <p className="subtle" style={{ marginTop: "0.5rem" }}>
          {error.message ?? "An unexpected error occurred. Please try again."}
        </p>
        <div className="button-row" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
          <button className="button" type="button" onClick={() => reset()}>
            Try again
          </button>
          <Link className="button ghost" href="/lobby">
            Back to lobby
          </Link>
        </div>
      </div>
    </main>
  );
}
