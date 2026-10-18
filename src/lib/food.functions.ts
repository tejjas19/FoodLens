import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeWithGemini } from "./food-ai";

export const analyzeFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ image: z.string().startsWith("data:image/").max(8_000_000), note: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured. Set GEMINI_API_KEY (free key from aistudio.google.com/apikey).");
    return analyzeWithGemini({
      image: data.image,
      note: data.note,
      apiKey,
      model: process.env["GEMINI_MODEL"] || undefined,
    });
  });
