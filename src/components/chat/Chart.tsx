import { useTheme } from "@/lib/theme";
import { useMemo } from "react";
import { fmt, niceMax, parseChart, SERIES_COLORS, type ChartSpec } from "@/lib/charts";

const W = 600;
const H = 300;
const PAD = { l: 44, r: 12, t: 16, b: 34 };

function Legend({ spec }: { spec: ChartSpec }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 text-[12px] text-e-dim">
      {spec.series.map((s, i) => (
        <span key={s.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function Axes({ max, n, labels }: { max: number; n: number; labels: string[] }) {
  const ih = H - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g fontSize="13" fill="var(--dim)">
      {ticks.map((t) => {
        const y = PAD.t + ih * (1 - t);
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray={t ? "3 4" : undefined} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end">{fmt(max * t)}</text>
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={i} x={PAD.l + (iw / n) * (i + 0.5)} y={H - 10} textAnchor="middle">{l.length > 10 ? l.slice(0, 9) + "…" : l}</text>
      ))}
    </g>
  );
}

function Bars({ spec }: { spec: ChartSpec }) {
  const n = spec.x.length;
  const max = niceMax(Math.max(...spec.series.flatMap((s) => s.values)));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const gw = iw / n;
  const bw = (gw * 0.76) / spec.series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de barras">
      <Axes max={max} n={n} labels={spec.x} />
      {spec.series.map((s, si) =>
        spec.x.map((_, i) => {
          const v = s.values[i] ?? 0;
          const h = (Math.max(v, 0) / max) * ih;
          const x = PAD.l + gw * i + gw * 0.12 + bw * si;
          const y = PAD.t + ih - h;
          return (
            <g key={`${si}-${i}`}>
              <rect x={x} y={y} width={bw - 2} height={h} rx={3} fill={SERIES_COLORS[si % SERIES_COLORS.length]} />
              {bw > 18 && <text x={x + (bw - 2) / 2} y={y - 4} textAnchor="middle" fontSize="12" fill="var(--tx)">{fmt(v)}</text>}
            </g>
          );
        }),
      )}
    </svg>
  );
}

function Lines({ spec }: { spec: ChartSpec }) {
  const n = spec.x.length;
  const max = niceMax(Math.max(...spec.series.flatMap((s) => s.values)));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const px = (i: number) => PAD.l + (iw / n) * (i + 0.5);
  const py = (v: number) => PAD.t + ih - (Math.max(v, 0) / max) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de líneas">
      <Axes max={max} n={n} labels={spec.x} />
      {spec.series.map((s, si) => {
        const c = SERIES_COLORS[si % SERIES_COLORS.length];
        const pts = s.values.slice(0, n).map((v, i) => `${px(i)},${py(v)}`).join(" ");
        return (
          <g key={s.name}>
            <polyline points={pts} fill="none" stroke={c} strokeWidth={2.5} strokeLinejoin="round" />
            {s.values.slice(0, n).map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r={4} fill="var(--bg2)" stroke={c} strokeWidth={2} />)}
          </g>
        );
      })}
    </svg>
  );
}

function Share({ spec }: { spec: ChartSpec }) {
  // One stacked 100% bar per x category; each series is a slice.
  const rows = spec.x.map((label, i) => ({ label, vals: spec.series.map((s) => Math.max(s.values[i] ?? 0, 0)) }));
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      {rows.map((r) => {
        const total = r.vals.reduce((a, b) => a + b, 0) || 1;
        return (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-e-dim">{r.label}</span>
            <div className="flex h-6 flex-1 overflow-hidden rounded">
              {r.vals.map((v, si) => {
                const pct = (v / total) * 100;
                return (
                  <div key={si} title={`${spec.series[si]!.name}: ${pct.toFixed(1)}%`} className="flex items-center justify-center overflow-hidden text-[11px] font-medium text-e-bg2" style={{ width: `${pct}%`, background: SERIES_COLORS[si % SERIES_COLORS.length] }}>
                    {pct >= 9 ? `${Math.round(pct)}%` : ""}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Chart({ source }: { source: string }) {
  const spec = useMemo(() => parseChart(source), [source]);
  const theme = useTheme();
  if (!spec) return <pre className="rounded-md border border-e-line bg-e-bg p-3 text-[12px] text-e-dim">{source}</pre>;
  // key={theme}: full SVG re-mount on theme change (not just CSS var repaint).
  return (
    <figure key={theme} data-chart-theme={theme} className="my-3 rounded-lg border border-e-line bg-e-bg2 p-3">
      {spec.type === "bar" ? <Bars spec={spec} /> : spec.type === "line" ? <Lines spec={spec} /> : <Share spec={spec} />}
      <Legend spec={spec} />
    </figure>
  );
}
