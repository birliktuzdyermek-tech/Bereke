import { money } from "@/lib/format";

export type DonutSlice = { name: string; total: number; color: string };
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Ring chart of expense shares. The centre shows the total; the caller renders the legend with the same numbers as text (the aria-label stays a plain translatable caption). */
export function Donut({ slices, total, caption }: { slices: DonutSlice[]; total: number; caption: string }) {
  const gap = slices.length > 1 ? 2 : 0;
  let offset = 0;
  return <div className="donut">
    <svg viewBox="0 0 140 140" role="img" aria-label={caption}>
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
