import { ImageResponse } from "next/og";
import { getCountryDetail } from "@/lib/db/queries";
import { formatMetric } from "@/lib/metrics/scales";

export const alt = "AI Atlas country profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Ramp step 4 for each layer. Satori cannot read CSS custom properties, so
 *  these are the one place a token value is repeated outside tokens.css. */
const LAYER_HEX: Record<string, string> = {
  adoption: "#3baa5f",
  investment: "#d18f28",
  development: "#8760be",
  research: "#2fa8a4",
};

export default async function Image({ params }: { params: Promise<{ iso3: string }> }) {
  const { iso3 } = await params;
  const country = await getCountryDetail(iso3);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#07080a",
        padding: 72,
        color: "#e8eaed",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: "#4cc9f0",
            display: "flex",
          }}
        />
        <span style={{ fontSize: 22, letterSpacing: 6, color: "#9ba1a8" }}>
          AI ATLAS
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 96, lineHeight: 1, fontWeight: 600 }}>
          {country?.name ?? "Unknown country"}
        </span>
        <span style={{ marginTop: 18, fontSize: 26, color: "#6b7178" }}>
          {country
            ? `${country.iso3}${country.region ? ` · ${country.region}` : ""}`
            : ""}
        </span>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {(country?.metrics ?? []).map((m) => (
          <div
            key={m.key}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "20px 24px",
              background: "#0e1014",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  display: "flex",
                  background: LAYER_HEX[m.layer ?? ""] ?? "#6b7178",
                }}
              />
              <span style={{ fontSize: 17, letterSpacing: 2, color: "#9ba1a8" }}>
                {m.shortLabel.toUpperCase()}
              </span>
            </div>
            <span style={{ marginTop: 12, fontSize: 34, fontWeight: 600 }}>
              {m.latest ? formatMetric(m.latest.value, m.unit, m.precision) : "No data"}
            </span>
            <span style={{ marginTop: 6, fontSize: 18, color: "#6b7178" }}>
              {m.latest?.rank ? `#${m.latest.rank} of ${m.latest.total}` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
