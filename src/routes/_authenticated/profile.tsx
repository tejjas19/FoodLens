import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — FoodLens" }, { name: "description", content: "Your FoodLens profile and goals." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle();
      const { count } = await supabase.from("meals").select("id", { count: "exact", head: true });
      return { user: u.user!, profile: p, meals: count ?? 0 };
    },
  });
  const [form, setForm] = useState({ display_name: "", bio: "", daily_calorie_goal: 2000, dietary_preference: "" });
  useEffect(() => {
    if (data?.profile) setForm({
      display_name: data.profile.display_name ?? "", bio: data.profile.bio ?? "",
      daily_calorie_goal: data.profile.daily_calorie_goal, dietary_preference: data.profile.dietary_preference ?? "",
    });
  }, [data?.profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const { error } = await supabase.from("profiles").upsert({ id: data.user.id, ...form, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-goal"] });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={data?.profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground">{(form.display_name || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold">{form.display_name || "Your profile"}</h1>
          <p className="text-sm text-muted-foreground">{data?.user.email} · {data?.meals ?? 0} meals logged</p>
        </div>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-3xl border bg-card p-6">
        <div className="space-y-1.5"><Label>Display name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={60} /></div>
        <div className="space-y-1.5"><Label>Bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={300} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Daily calorie goal</Label><Input type="number" min={800} max={6000} value={form.daily_calorie_goal} onChange={(e) => setForm({ ...form, daily_calorie_goal: +e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Diet preference</Label><Input placeholder="e.g. vegetarian" value={form.dietary_preference} onChange={(e) => setForm({ ...form, dietary_preference: e.target.value })} maxLength={60} /></div>
        </div>
        <Button>Save changes</Button>
      </form>
    </div>
  );
}
