import { money } from "@/lib/format";

export type DonutSlice = { name: string; total: number; color: string };
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Ring chart of expense shares. The centre shows the total; the legend next to it is rendered by the caller. */
export function Donut({ slices, total, caption }: { slices: DonutSlice[]; total: number; caption: string }) {
  const gap = slices.length > 1 ? 2 : 0;
  let offset = 0;
  const label = slices.map(slice => `${slice.name} ${total > 0 ? Math.round(slice.total / total * 100) : 0}%`).join(", ");
  return <div className="donut">
    <svg viewBox="0 0 140 140" role="img" aria-label={label || caption}>
      <g transform="rotate(-90 70 70)" fill="none" strokeWidth="18">
        <circle className="donut-track" cx="70" cy="70" r={RADIUS}/>
        {total > 0 && slices.map(slice => {
          const length = slice.total / total * CIRCUMFERENCE;
          const arc = <circle key={slice.name} className="donut-slice" cx="70" cy="70" r={RADIUS} stroke={slice.color} strokeDasharray={`${Math.max(0, length - gap)} ${CIRCUMFERENCE}`} strokeDashoffset={-offset}/>;
          offset += length;
          return arc;
        })}
      </g>
    </svg>
    <div className="donut-centre"><b>{money(total)}</b><small>{caption}</small></div>
  </div>;
}
