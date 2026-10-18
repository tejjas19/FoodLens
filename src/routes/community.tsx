import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, ImageUp, Plus, Search, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { fileToJpegDataUrl } from "@/lib/food-types";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/community")({
  validateSearch: z.object({ share: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Community kitchen — FoodLens" },
      { name: "description", content: "Discover healthy dishes and recipes shared by the FoodLens community." },
      { property: "og:title", content: "Community kitchen — FoodLens" },
      { property: "og:description", content: "Discover healthy dishes and recipes shared by the FoodLens community." },
    ],
  }),
  component: CommunityPage,
});

type Post = {
  id: string; user_id: string; title: string; body: string | null; recipe: string | null; image_path: string | null;
  tags: string[]; calories: number | null; health_score: number | null; likes_count: number; created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null; url?: string;
};

function CommunityPage() {
  const { share } = Route.useSearch();
  const { user } = useSession();
  const qc = useQueryClient();
  const [sort, setSort] = useState<"recent" | "popular" | "for-you">("recent");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Post | null>(null);

  useEffect(() => { if (share && user) setOpen(true); }, [share, user]);

  const { data: posts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*, profiles(display_name, avatar_url)").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const paths = data.map((p) => p.image_path).filter(Boolean) as string[];
      const signed = paths.length ? (await supabase.storage.from("community-images").createSignedUrls(paths, 3600)).data ?? [] : [];
      const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
      return data.map((p) => ({ ...p, url: p.image_path ? map.get(p.image_path) : undefined })) as Post[];
    },
  });

  const { data: liked = new Set<string>() } = useQuery({
    queryKey: ["likes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("post_likes").select("post_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((l) => l.post_id));
    },
  });

  // Recommendations: posts sharing tags with the user's recent meals
  const { data: myTags = [] } = useQuery({
    queryKey: ["my-tags", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("meals").select("analysis").order("eaten_at", { ascending: false }).limit(20);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m) => ((m.analysis as { tags?: string[] })?.tags ?? []).forEach((t) => (counts[t.toLowerCase()] = (counts[t.toLowerCase()] ?? 0) + 1)));
      return Object.keys(counts);
    },
  });

  const shown = useMemo(() => {
    let list = posts.filter((p) => !q || (p.title + " " + p.tags.join(" ") + " " + (p.body ?? "")).toLowerCase().includes(q.toLowerCase()));
    if (sort === "popular") list = [...list].sort((a, b) => b.likes_count - a.likes_count);
    if (sort === "for-you") {
      const score = (p: Post) => p.tags.filter((t) => myTags.includes(t.toLowerCase())).length * 10 + (p.health_score ?? 0) / 10 + p.likes_count;
      list = [...list].sort((a, b) => score(b) - score(a));
    }
    return list;
  }, [posts, q, sort, myTags]);

  async function toggleLike(p: Post) {
    if (!user) { toast("Sign in to like posts"); return; }
    if (liked.has(p.id)) await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", user.id);
    else await supabase.from("post_likes").insert({ post_id: p.id, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["posts"] });
    qc.invalidateQueries({ queryKey: ["likes"] });
  }

  async function del(p: Post) {
    if (p.image_path) await supabase.storage.from("community-images").remove([p.image_path]);
    await supabase.from("posts").delete().eq("id", p.id);
    setView(null);
    qc.invalidateQueries({ queryKey: ["posts"] });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Community kitchen</h1>
            <p className="mt-1 text-muted-foreground">Share dishes, swap recipes, find your next healthy favourite.</p>
          </div>
          {user ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Share a dish</Button>
            : <Button asChild variant="outline"><Link to="/auth">Sign in to share</Link></Button>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search dishes or tags" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1 rounded-xl border p-1">
            {(["recent", "popular", ...(user ? ["for-you"] : [])] as const).map((s) => (
              <button key={s} onClick={() => setSort(s as typeof sort)}
                className={cn("rounded-lg px-3 py-1.5 text-sm capitalize", sort === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {s.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">No posts yet — be the first to share a dish.</div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {shown.map((p) => (
              <article key={p.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border bg-card">
                <button className="block w-full text-left" onClick={() => setView(p)}>
                  {p.url && <img src={p.url} alt={p.title} loading="lazy" className="w-full object-cover" />}
                  <div className="p-4">
                    <h3 className="font-semibold">{p.title}</h3>
                    {p.body && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.calories != null && <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs text-accent-foreground">{Math.round(p.calories)} kcal</span>}
                      {p.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">#{t}</span>)}
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                  <span className="truncate text-muted-foreground">{p.profiles?.display_name ?? "Someone"}</span>
                  <button onClick={() => toggleLike(p)} className={cn("flex items-center gap-1", liked.has(p.id) ? "text-primary" : "text-muted-foreground")}>
                    <Heart className={cn("h-4 w-4", liked.has(p.id) && "fill-current")} /> {p.likes_count}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {user && <NewPostDialog open={open} onOpenChange={setOpen} userId={user.id} initialTitle={share ?? ""} />}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{view?.title}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-4">
              {view.url && <img src={view.url} alt={view.title} className="w-full rounded-xl object-cover" />}
              {view.body && <p className="text-muted-foreground">{view.body}</p>}
              {view.recipe && (
                <div className="rounded-xl border bg-muted/40 p-4">
                  <h4 className="font-semibold">Recipe</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{view.recipe}</p>
                </div>
              )}
              {user?.id === view.user_id && <Button variant="destructive" size="sm" onClick={() => del(view)}><Trash2 className="h-4 w-4" /> Delete post</Button>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function NewPostDialog({ open, onOpenChange, userId, initialTitle }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; initialTitle: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [recipe, setRecipe] = useState("");
  const [tags, setTags] = useState("");
  const [calories, setCalories] = useState("");
  const [img, setImg] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (initialTitle) setTitle(initialTitle); }, [initialTitle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let image_path: string | null = null;
    if (img) {
      image_path = `${userId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("community-images").upload(image_path, img.blob, { contentType: "image/jpeg" });
      if (up.error) { setBusy(false); { toast.error(up.error.message); return; } }
    }
    const { error } = await supabase.from("posts").insert({
      user_id: userId, title: title.trim(), body: body.trim() || null, recipe: recipe.trim() || null, image_path,
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean).slice(0, 8),
      calories: calories ? +calories : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shared with the community");
    setTitle(""); setBody(""); setRecipe(""); setTags(""); setCalories(""); setImg(null);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["posts"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Share a dish</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="grid aspect-video cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed bg-muted/40">
            {img ? <img src={img.dataUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex items-center gap-2 text-sm text-muted-foreground"><ImageUp className="h-4 w-4" /> Add photo</span>}
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await fileToJpegDataUrl(f, 1400)); }} />
          </label>
          <Input required maxLength={100} placeholder="Dish name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea maxLength={500} placeholder="What makes it great?" value={body} onChange={(e) => setBody(e.target.value)} />
          <Textarea maxLength={3000} rows={5} placeholder="Recipe (ingredients & steps, optional)" value={recipe} onChange={(e) => setRecipe(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Tags: vegan, high-protein" value={tags} onChange={(e) => setTags(e.target.value)} />
            <Input type="number" min={0} placeholder="Calories" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy}>{busy ? "Posting…" : "Post"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
