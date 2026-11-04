"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporting";

// Root error boundary for the App Router. This replaces the root layout when
// active, so it must render its own <html> and <body> and cannot rely on
// global stylesheets being loaded: styles are inlined to stay self-contained.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <title>Something went wrong - KeysReady</title>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fafafa",
          color: "#171717",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "26rem",
            textAlign: "center",
            border: "1px solid #e5e5e5",
            borderRadius: "1rem",
            background: "#ffffff",
            padding: "2rem 1.5rem",
            boxSizing: "border-box",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#d40000",
              margin: 0,
            }}
          >
            KeysReady
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.95rem",
              color: "#525252",
            }}
          >
            We hit an unexpected problem and have been told about it. Your
            bookings are safe.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              minHeight: "48px",
              width: "100%",
              border: "none",
              borderRadius: "0.75rem",
              background: "#d40000",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
