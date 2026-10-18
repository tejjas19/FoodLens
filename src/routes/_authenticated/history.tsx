import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { eachDayOfInterval, format, isSameDay, startOfDay, subDays } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AnalysisView, ScoreRing } from "@/components/AnalysisView";
import type { FoodAnalysis } from "@/lib/food-types";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Meal history — FoodLens" }, { name: "description", content: "Your daily, weekly and monthly nutrition trends." }] }),
  component: HistoryPage,
});

type Meal = {
  id: string; name: string; meal_type: string; health_score: number; calories: number; protein: number;
  carbs: number; fat: number; fiber: number; eaten_at: string; image_path: string | null; analysis: unknown; url?: string;
};

const ranges = { day: 1, week: 7, month: 30 } as const;
type Range = keyof typeof ranges;

function HistoryPage() {
  const [range, setRange] = useState<Range>("week");
  const [open, setOpen] = useState<Meal | null>(null);
  const qc = useQueryClient();

  const { data: goal = 2000 } = useQuery({
    queryKey: ["profile-goal"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("daily_calorie_goal").eq("id", u.user!.id).maybeSingle();
      return data?.daily_calorie_goal ?? 2000;
    },
  });

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ["meals", range],
    queryFn: async () => {
      const since = startOfDay(subDays(new Date(), ranges[range] - 1)).toISOString();
      const { data, error } = await supabase.from("meals").select("*").gte("eaten_at", since).order("eaten_at", { ascending: false });
      if (error) throw error;
      const paths = data.map((m) => m.image_path).filter(Boolean) as string[];
      const signed = paths.length ? (await supabase.storage.from("meal-images").createSignedUrls(paths, 3600)).data ?? [] : [];
      const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
      return data.map((m) => ({ ...m, url: m.image_path ? map.get(m.image_path) : undefined })) as Meal[];
    },
  });

  const totals = useMemo(() => {
    const t = meals.reduce((a, m) => ({ cal: a.cal + +m.calories, p: a.p + +m.protein, c: a.c + +m.carbs, f: a.f + +m.fat, fi: a.fi + +m.fiber, s: a.s + m.health_score }), { cal: 0, p: 0, c: 0, f: 0, fi: 0, s: 0 });
    const days = ranges[range];
    return { ...t, avgCal: t.cal / days, avgScore: meals.length ? t.s / meals.length : 0 };
  }, [meals, range]);

  const series = useMemo(() => {
    if (range === "day") {
      return meals.slice().reverse().map((m) => ({ label: format(new Date(m.eaten_at), "HH:mm"), calories: Math.round(+m.calories), protein: Math.round(+m.protein), carbs: Math.round(+m.carbs), fat: Math.round(+m.fat) }));
    }
    const days = eachDayOfInterval({ start: subDays(new Date(), ranges[range] - 1), end: new Date() });
    return days.map((d) => {
      const ms = meals.filter((m) => isSameDay(new Date(m.eaten_at), d));
      return {
        label: format(d, range === "week" ? "EEE" : "d MMM"),
        calories: Math.round(ms.reduce((a, m) => a + +m.calories, 0)),
        protein: Math.round(ms.reduce((a, m) => a + +m.protein, 0)),
        carbs: Math.round(ms.reduce((a, m) => a + +m.carbs, 0)),
        fat: Math.round(ms.reduce((a, m) => a + +m.fat, 0)),
      };
    });
  }, [meals, range]);

  async function remove(m: Meal) {
    if (m.image_path) await supabase.storage.from("meal-images").remove([m.image_path]);
    const { error } = await supabase.from("meals").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    setOpen(null);
    qc.invalidateQueries({ queryKey: ["meals"] });
  }

  const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }, labelStyle: { color: "var(--foreground)" } };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">History</h1>
          <p className="mt-1 text-muted-foreground">Your nutrition over time.</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={range === "day" ? "Calories" : "Avg kcal/day"} value={Math.round(range === "day" ? totals.cal : totals.avgCal)} sub={`goal ${goal}`} />
        <Stat label="Protein" value={`${Math.round(totals.p)}g`} />
        <Stat label="Carbs" value={`${Math.round(totals.c)}g`} />
        <Stat label="Fat" value={`${Math.round(totals.f)}g`} />
        <Stat label="Avg score" value={Math.round(totals.avgScore)} sub={`${meals.length} meals`} />
      </div>

      {range === "day" && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex justify-between text-sm"><span>Daily goal</span><span className="font-mono">{Math.round(totals.cal)} / {goal} kcal</span></div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (totals.cal / goal) * 100)}%` }} /></div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Calories</h3>
          <div className="mt-4 h-60">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity={0.5} /><stop offset="1" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tip} />
                <Area dataKey="calories" stroke="var(--primary)" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Macros (g)</h3>
          <div className="mt-4 h-60">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="protein" stackId="a" fill="var(--protein)" />
                <Bar dataKey="carbs" stackId="a" fill="var(--carbs)" />
                <Bar dataKey="fat" stackId="a" fill="var(--fat)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xl font-semibold">Meals</h3>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No meals logged in this period yet.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meals.map((m) => (
              <button key={m.id} onClick={() => setOpen(m)} className="flex items-center gap-4 rounded-2xl border bg-card p-3 text-left transition hover:border-primary">
                {m.url ? <img src={m.url} alt={m.name} loading="lazy" className="h-16 w-16 rounded-xl object-cover" /> : <div className="h-16 w-16 rounded-xl bg-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.name}</div>
                  <div className="font-mono text-xs capitalize text-muted-foreground">{m.meal_type} · {format(new Date(m.eaten_at), "d MMM, HH:mm")}</div>
                  <div className="mt-1 text-sm text-primary">{Math.round(+m.calories)} kcal</div>
                </div>
                <ScoreRing score={m.health_score} size={48} />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="sr-only">{open?.name}</DialogTitle>
          {open && (
            <div className="space-y-4">
              {open.url && <img src={open.url} alt={open.name} className="max-h-72 w-full rounded-2xl object-cover" />}
              <AnalysisView a={open.analysis as FoodAnalysis} />
              <Button variant="destructive" onClick={() => remove(open)}><Trash2 className="h-4 w-4" /> Delete meal</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="font-mono text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
