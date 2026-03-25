import Image from "next/image";

import sflLogo from "./images/sfl.png";

export default function Loading() {
  return (
    <main className="sfl-loader-screen" aria-live="polite" aria-busy="true">
      <div className="sfl-loader-frame" />
      <div className="sfl-loader-beam sfl-loader-beam-left" aria-hidden="true" />
      <div className="sfl-loader-beam sfl-loader-beam-right" aria-hidden="true" />

      <div className="sfl-loader-shell">
        <div className="sfl-loader-status">Loading experience</div>

        <div className="sfl-loader-brand">
          <div className="sfl-loader-logo-wrap">
            <Image
              alt="SFL"
              className="sfl-loader-logo"
              priority
              src={sflLogo}
              width={92}
              height={92}
            />
          </div>

          <div className="sfl-loader-text">
            <div className="sfl-loader-wordmark">SFL</div>
            <div className="sfl-loader-subtitle">St. Thomas Fantasy League</div>
            <div className="sfl-loader-caption">Fantasy auction platform</div>
          </div>
        </div>

        <div className="sfl-loader-accent" aria-hidden="true">
          <span className="sfl-loader-accent-line" />
          <span className="sfl-loader-accent-glow" />
        </div>

        <div className="sfl-loader-bar" aria-hidden="true">
          <span className="sfl-loader-bar-fill" />
        </div>
      </div>
    </main>
  );
}
