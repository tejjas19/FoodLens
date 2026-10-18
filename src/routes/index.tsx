import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, LineChart, Sparkles, Users } from "lucide-react";
import hero from "@/assets/hero-bowl.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodLens — Snap your food, know your nutrition" },
      { name: "description", content: "AI food recognition that estimates calories, macros, vitamins and a health score from a single photo." },
      { property: "og:title", content: "FoodLens — Snap your food, know your nutrition" },
      { property: "og:description", content: "AI food recognition with calories, macros, vitamins, healthier swaps and recipes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Camera, title: "Snap or upload", text: "Take a photo of any plate. Our vision model spots each ingredient." },
  { icon: Sparkles, title: "Full nutrient breakdown", text: "Calories, macros, fiber, vitamins, minerals and a 0–100 health score." },
  { icon: LineChart, title: "Daily to monthly trends", text: "Every meal is logged so you can see how your week really looks." },
  { icon: Users, title: "Community kitchen", text: "Share dishes and recipes, discover what others are cooking." },
];

function Landing() {
  return (
    <div className="min-h-screen grid-lines">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/community">Community</Link></Button>
          <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Vision AI nutrition
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] md:text-7xl">
            Point. Shoot.<br /><span className="text-primary">Know what you eat.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            FoodLens reads your plate from one photo and tells you calories, macros, micronutrients and how healthy it really is.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/scan">Scan a meal <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link to="/community">Explore recipes</Link></Button>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 glow-bg" />
          <div className="relative overflow-hidden rounded-3xl border">
            <img src={hero} alt="Salmon poke bowl being analysed" width={1280} height={1280} className="aspect-square w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 scan-line" />
            <div className="absolute bottom-4 left-4 right-4 grid grid-cols-4 gap-2 rounded-2xl border bg-background/80 p-3 backdrop-blur">
              {[["kcal", "540"], ["protein", "34g"], ["carbs", "48g"], ["score", "88"]].map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="font-display text-lg font-bold text-primary">{v}</div>
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
