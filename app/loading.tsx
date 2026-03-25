import Image from "next/image";

import sflLogo from "./images/sfl.png";

export default function Loading() {
  return (
    <main className="sfl-loader-screen" aria-live="polite" aria-busy="true">
      {/* Ultra-thin top progress bar */}
      <div className="sfl-loader-topbar" aria-hidden="true">
        <span className="sfl-loader-topbar-fill" />
      </div>

      {/* Ambient glow blobs */}
      <div className="sfl-loader-orb sfl-loader-orb-one" />
      <div className="sfl-loader-orb sfl-loader-orb-two" />

      {/* Particles */}
      <div className="sfl-loader-particles" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="sfl-loader-particle"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Centre stage */}
      <div className="sfl-loader-stage">
        <div className="sfl-loader-core">
          {/* Single conic arc spinner */}
          <div className="sfl-loader-arc sfl-loader-arc-outer" />
          <div className="sfl-loader-arc sfl-loader-arc-mid" />
          <div className="sfl-loader-ghost-ring" />

          {/* Logo */}
          <div className="sfl-loader-logo-wrap">
            <div className="sfl-loader-logo-glow" />
            <Image
              alt="SFL logo"
              className="sfl-loader-logo"
              priority
              src={sflLogo}
              width={120}
              height={120}
            />
          </div>
        </div>

        {/* Wordmark */}
        <div className="sfl-loader-copy">
          <div className="sfl-loader-wordmark">
            <span>S</span><span>F</span><span>L</span>
          </div>
          <div className="sfl-loader-subtitle">St. Thomas Fantasy League</div>
        </div>

        {/* Dots */}
        <div className="sfl-loader-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </main>
  );
}

