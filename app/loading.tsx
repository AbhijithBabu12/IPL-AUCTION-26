import Image from "next/image";

import sflLogo from "./images/sfl.png";

export default function Loading() {
  return (
    <main className="sfl-loader-screen" aria-live="polite" aria-busy="true">
      {/* Ambient orbs */}
      <div className="sfl-loader-orb sfl-loader-orb-one" />
      <div className="sfl-loader-orb sfl-loader-orb-two" />
      <div className="sfl-loader-orb sfl-loader-orb-three" />

      {/* Particle dots */}
      <div className="sfl-loader-particles" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="sfl-loader-particle" style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      {/* Central spinner + logo */}
      <div className="sfl-loader-stage">
        <div className="sfl-loader-core">
          {/* Conic arc — outer track */}
          <div className="sfl-loader-arc sfl-loader-arc-outer" />
          {/* Conic arc — middle track (reverse) */}
          <div className="sfl-loader-arc sfl-loader-arc-mid" />
          {/* Static ghost ring */}
          <div className="sfl-loader-ghost-ring" />

          {/* Logo centrepiece */}
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

        {/* Text block */}
        <div className="sfl-loader-copy">
          <div className="sfl-loader-wordmark">
            <span>S</span><span>F</span><span>L</span>
          </div>
          <div className="sfl-loader-subtitle">St. Thomas Fantasy League</div>
        </div>

        {/* Progress bar */}
        <div className="sfl-loader-bar" aria-hidden="true">
          <span className="sfl-loader-bar-fill" />
        </div>

        {/* Loading dots */}
        <div className="sfl-loader-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </main>
  );
}
