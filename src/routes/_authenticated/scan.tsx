import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImageUp, Loader2, RotateCcw, Save, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeFood } from "@/lib/food.functions";
import { fileToJpegDataUrl, type FoodAnalysis } from "@/lib/food-types";
import { AnalysisView } from "@/components/AnalysisView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan a meal — FoodLens" }, { name: "description", content: "Analyze a food photo with AI." }] }),
  component: ScanPage,
});

function defaultMealType() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

function ScanPage() {
  const analyze = useServerFn(analyzeFood);
  const qc = useQueryClient();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState("");
  const [mealType, setMealType] = useState(defaultMealType());
  const [result, setResult] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onFile(f?: File) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const { dataUrl, blob } = await fileToJpegDataUrl(f);
    setPreview(dataUrl); setBlob(blob); setResult(null); setSaved(false);
  }

  async function run() {
    if (!preview) return;
    setLoading(true);
    try {
      const r = await analyze({ data: { image: preview, note: note || undefined } });
      if (!r.is_food) toast.warning("That doesn't look like food. Try another photo.");
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!result || !blob) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from("meal-images").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) { setSaving(false); { toast.error(up.error.message); return; } }
    const { error } = await supabase.from("meals").insert({
      user_id: uid, image_path: path, name: result.name, meal_type: mealType,
      health_score: Math.round(result.health_score), calories: result.calories, protein: result.protein_g,
      carbs: result.carbs_g, fat: result.fat_g, fiber: result.fiber_g, analysis: result as never,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSaved(true);
    qc.invalidateQueries({ queryKey: ["meals"] });
    toast.success("Saved to your history");
  }

  function reset() { setPreview(null); setBlob(null); setResult(null); setSaved(false); setNote(""); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Scan a meal</h1>
        <p className="mt-1 text-muted-foreground">Take a photo or upload one — the AI does the rest.</p>
      </div>

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative aspect-square overflow-hidden rounded-3xl border bg-card grid-lines">
          {preview ? (
            <>
              <img src={preview} alt="Your meal" className="h-full w-full object-cover" />
              {loading && <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 scan-line" />}
            </>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="grid h-full w-full place-items-center p-8 text-center glow-bg"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}>
              <div>
                <ImageUp className="mx-auto h-12 w-12 text-primary" />
                <div className="mt-4 font-display text-xl font-semibold">Drop a food photo</div>
                <div className="mt-1 text-sm text-muted-foreground">or tap to browse</div>
              </div>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" variant="outline" onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" /> Camera</Button>
            <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()}><ImageUp className="h-4 w-4" /> Upload</Button>
          </div>
          <Input placeholder="Optional note, e.g. 'large portion, extra cheese'" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <Select value={mealType} onValueChange={setMealType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["breakfast", "lunch", "dinner", "snack"].map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="lg" className="shadow-glow" disabled={!preview || loading} onClick={run}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : "Analyze nutrition"}
          </Button>
          {result?.is_food && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" disabled={saving || saved} onClick={save}>
                <Save className="h-4 w-4" /> {saved ? "Saved" : saving ? "Saving…" : "Log meal"}
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/community" search={{ share: result.name }}><Share2 className="h-4 w-4" /> Share</Link>
              </Button>
            </div>
          )}
          {preview && <Button variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /> Start over</Button>}
        </div>
      </div>

      {result?.is_food && <AnalysisView a={result} />}
    </div>
  );
}
