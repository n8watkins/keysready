import { ImageResponse } from "next/og";

// Rendered once at build time for the static export.
export const dynamic = "force-static";

export const alt = "KeysReady: stop answering \"Is my car ready?\"";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "64px 72px",
          background: "#16171b",
          color: "#f1efe9",
          fontFamily: "sans-serif",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#43d095" }} />
            KeysReady
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>Stop answering</div>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2, color: "#ff5a4e" }}>
              &ldquo;Is my car ready?&rdquo;
            </div>
          </div>
          <div style={{ fontSize: 28, color: "#a6a4ad" }}>Booking, live repair status and pay-by-phone for small shops.</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: 360,
            background: "#0a0a0c",
            border: "2px solid #2a2b31",
            borderRadius: 32,
            padding: 24,
          }}
        >
          {[
            ["Booking confirmed", "Drop-off Tuesday at 8:00", "#2a2b31"],
            ["Estimate: $412.80", "Tap approve to start the work", "#362c14"],
            ["Your car is ready", "Paid. Keys at the front desk", "#10302a"],
          ].map(([title, body, bg]) => (
            <div
              key={title}
              style={{ display: "flex", flexDirection: "column", gap: 6, background: bg, borderRadius: 18, padding: "18px 20px" }}
            >
              <div style={{ fontSize: 24, fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: 20, color: "#a6a4ad" }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
