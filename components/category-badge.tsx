import { categoryStyle } from "@/lib/categories";

/** Rounded tinted square with the category icon; the tone classes live in globals.css. */
export function CategoryBadge({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  const { icon: Icon, tone } = categoryStyle(name);
  return <span className={`cbadge cbadge-${tone}${className ? ` ${className}` : ""}`} aria-hidden="true"><Icon size={size} strokeWidth={1.9}/></span>;
}
