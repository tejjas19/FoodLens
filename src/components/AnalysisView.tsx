import { Clock, Leaf } from "lucide-react";
import type { FoodAnalysis } from "@/lib/food-types";
import { scoreTone } from "@/lib/food-types";
import { cn } from "@/lib/utils";

const toneText = { good: "text-good", ok: "text-ok", bad: "text-bad" };
const toneStroke = { good: "stroke-good", ok: "stroke-ok", bad: "stroke-bad" };

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} className={cn("fill-none", toneStroke[tone])} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("font-display text-2xl font-bold", toneText[tone])}>{Math.round(score)}</span>
      </div>
    </div>
  );
}

function Macro({ label, value, unit, cls }: { label: string; value: number; unit: string; cls: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", cls)} /> {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{Math.round(value)}<span className="ml-0.5 text-sm text-muted-foreground">{unit}</span></div>
    </div>
  );
}

function NutrientList({ title, items }: { title: string; items: FoodAnalysis["vitamins"] }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((n) => (
          <div key={n.name}>
            <div className="flex justify-between text-sm">
              <span>{n.name}</span>
              <span className="font-mono text-muted-foreground">{n.amount}{n.unit} · {Math.round(n.daily_value_pct)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, n.daily_value_pct)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisView({ a }: { a: FoodAnalysis }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-5 rounded-3xl border bg-card p-6">
        <ScoreRing score={a.health_score} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs uppercase text-muted-foreground">Health score · {Math.round(a.confidence * 100)}% confident</div>
          <h2 className="mt-1 text-3xl font-bold">{a.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{a.portion} — {a.health_summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.tags.map((t) => <span key={t} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">{t}</span>)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl font-bold text-primary">{Math.round(a.calories)}</div>
          <div className="font-mono text-xs text-muted-foreground">kcal</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Macro label="Protein" value={a.protein_g} unit="g" cls="bg-protein" />
        <Macro label="Carbs" value={a.carbs_g} unit="g" cls="bg-carbs" />
        <Macro label="Fat" value={a.fat_g} unit="g" cls="bg-fat" />
        <Macro label="Fiber" value={a.fiber_g} unit="g" cls="bg-fiber" />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        {[["Sugar", a.sugar_g, "g"], ["Sodium", a.sodium_mg, "mg"], ["Sat. fat", a.saturated_fat_g, "g"]].map(([l, v, u]) => (
          <div key={l as string} className="rounded-xl border p-3"><span className="text-muted-foreground">{l}</span> <b className="ml-1">{Math.round(v as number)}{u}</b></div>
        ))}
      </div>

      {a.items.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Detected items</h3>
          <div className="mt-3 divide-y">
            {a.items.map((i) => (
              <div key={i.name} className="flex justify-between py-2 text-sm">
                <span>{i.name}</span>
                <span className="font-mono text-muted-foreground">{Math.round(i.estimated_grams)}g · {Math.round(i.calories)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <NutrientList title="Vitamins" items={a.vitamins} />
        <NutrientList title="Minerals" items={a.minerals} />
      </div>

      <div>
        <h3 className="mb-3 text-xl font-semibold">Healthier alternatives</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {a.alternatives.map((x) => (
            <div key={x.name} className="rounded-2xl border bg-card p-5">
              <Leaf className="h-5 w-5 text-primary" />
              <div className="mt-3 font-semibold">{x.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{x.why}</p>
              <div className="mt-3 font-mono text-xs text-primary">~{Math.round(x.calories)} kcal</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xl font-semibold">Recipe ideas</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {a.recipes.map((r) => (
            <div key={r.title} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.title}</div>
                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground"><Clock className="h-3 w-3" />{r.time_minutes}m</span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {r.ingredients.map((i) => <li key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs">{i}</li>)}
              </ul>
              <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                {r.steps.map((s, idx) => <li key={idx}>{s}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
