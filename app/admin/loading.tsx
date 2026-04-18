export default function AdminLoading() {
  return (
    <main className="shell" style={{ paddingTop: "2rem" }}>
      <div className="panel" style={{ marginBottom: "1.5rem", minHeight: "80px", background: "rgba(255,255,255,0.02)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {[1,2,3,4,5,6,7].map((i) => (
          <div key={i} style={{ height: "56px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.12)" }} />
        ))}
      </div>
    </main>
  );
}
