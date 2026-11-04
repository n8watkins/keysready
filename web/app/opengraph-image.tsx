import { OG_SIZE, dataUrl, shareCard } from "@/lib/og-card";
import { readPublicFile } from "@/lib/publicFile";

// The share card (Open Graph and Twitter): the n8builds family layout in the
// landing's ink, cream and green, with the customer's status updates on a phone.

export const alt = "KeysReady: stop answering “Is my car ready?” Booking, live status and pay-by-phone for small shops.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  // Geist and Archivo (OFL, licenses in public/og/) and the marks, from public/.
  const [medium, bold, display, mark, n8] = await Promise.all([
    readPublicFile("/og/Geist-Medium.ttf"),
    readPublicFile("/og/Geist-Bold.ttf"),
    readPublicFile("/og/Archivo-ExtraBold.ttf"),
    readPublicFile("/og/keysready-mark.svg"),
    readPublicFile("/og/n8-icon.png"),
  ]);
  const markUrl = dataUrl(mark, "image/svg+xml");

  return shareCard({
    colors: {
      bg: "#16171b",
      bgImage: "radial-gradient(circle at 80% 45%, rgba(67,208,149,0.14), rgba(22,23,27,0) 55%)",
      ink: "#f1efe9",
      muted: "#a6a4ad",
      body: "#d6d3cc",
      accent: "#43d095",
    },
    font: "Geist",
    headFont: "Archivo",
    fonts: [
      { name: "Geist", data: medium, weight: 500 },
      { name: "Geist", data: bold, weight: 700 },
      { name: "Archivo", data: display, weight: 800 },
    ],
    logo: markUrl,
    n8Icon: dataUrl(n8, "image/png"),
    host: "app.keysready.n8builds.dev",
    name: "KeysReady",
    nameTracking: -2.6,
    tagline: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex" }}>
          Stop answering&nbsp;<span style={{ color: "#ff5a4e" }}>{"“Is my car ready?”"}</span>
        </div>
        <div style={{ display: "flex" }}>Booking, live status and pay-by-phone for small shops.</div>
      </div>
    ),
    visual: <StatusPhone mark={markUrl} />,
  });
}

const tones = {
  received: { bg: "#1a1a1f", line: "#2c2c33", tag: "#a1a1aa" },
  approve: { bg: "#2b2414", line: "#4d3f1c", tag: "#f2c14e" },
  ready: { bg: "#10241b", line: "#1d4a35", tag: "#43d095" },
};

function Update({ tag, title, body, tone }: { tag: string; title: string; body: string; tone: (typeof tones)["ready"] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "18px 20px",
        borderRadius: 18,
        background: tone.bg,
        border: `1.5px solid ${tone.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 1.4, color: tone.tag }}>{tag}</div>
        <div style={{ display: "flex", fontSize: 15, color: "#8a8a92" }}>now</div>
      </div>
      <div style={{ display: "flex", fontSize: 25, fontWeight: 800, color: "#f4f4f5", fontFamily: "Archivo" }}>{title}</div>
      <div style={{ display: "flex", fontSize: 19, color: "#b4b4bb" }}>{body}</div>
    </div>
  );
}

/** A customer's phone with the three updates a repair goes through. */
function StatusPhone({ mark }: { mark: string }) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: 742,
        top: 64,
        width: 350,
        height: 640,
        padding: 10,
        borderRadius: 52,
        background: "#2a2a30",
        boxShadow: "0 30px 70px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: 330,
          height: 620,
          padding: "40px 16px 0",
          borderRadius: 42,
          background: "#0a0a0c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <img src={mark} width={34} height={34} alt="" style={{ borderRadius: 9 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 19, fontWeight: 800, color: "#f4f4f5", fontFamily: "Archivo" }}>
              Riverside Auto
            </div>
            <div style={{ display: "flex", fontSize: 15, color: "#8a8a92" }}>2019 Civic, brakes</div>
          </div>
        </div>
        <Update tag="RECEIVED" title="Car received" body="Drop-off at 8:00." tone={tones.received} />
        <Update tag="APPROVE" title="Estimate: $412.80" body="Brakes. Tap to approve." tone={tones.approve} />
        <Update tag="READY" title="Your car is ready" body="Paid. Keys at the front desk." tone={tones.ready} />
      </div>
    </div>
  );
}
