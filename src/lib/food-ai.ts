import { z } from "zod";
import type { FoodAnalysis } from "./food-types";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

const OUTPUT_SHAPE = `{
  "is_food": boolean,
  "name": string,
  "description": string,
  "confidence": number (0-1),
  "portion": string,
  "items": [{ "name": string, "estimated_grams": number, "calories": number }],
  "health_score": integer (0-100),
  "health_summary": string,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "sodium_mg": number,
  "saturated_fat_g": number,
  "vitamins": [{ "name": string, "amount": number, "unit": string, "daily_value_pct": number }],
  "minerals": [{ "name": string, "amount": number, "unit": string, "daily_value_pct": number }],
  "tags": [string],
  "alternatives": [{ "name": string, "why": string, "calories": number }],
  "recipes": [{ "title": string, "time_minutes": number, "ingredients": [string], "steps": [string] }]
}`;

export const FOOD_PROMPT = `You are FoodLens, an expert food-recognition and nutrition model.
Identify the dish and each visible component in the photo, estimate portion sizes in grams, and estimate nutrition for the whole visible serving.
- health_score: 0-100 (100 = very nutritious, balanced, minimally processed).
- confidence: 0-1.
- vitamins: 5-8 most relevant (e.g. Vitamin A, C, D, B12, K, Folate) with amount, unit and % daily value.
- minerals: 5-8 most relevant (Iron, Calcium, Potassium, Magnesium, Zinc, Sodium...).
- tags: short diet tags like "high-protein", "vegetarian", "gluten-free".
- alternatives: 3 healthier swaps with a one-line reason.
- recipes: 2 healthier home recipes inspired by this dish, 5-8 ingredients and 4-6 short steps each.
If the image is not food, set is_food=false, name="Not food", and use zeros/empty arrays.
Keep text concise.

Respond with a single JSON object only, exactly in this shape:
${OUTPUT_SHAPE}`;

const num = z.coerce.number().catch(0);
const str = z.string().catch("");
const nutrient = z.object({ name: str, amount: num, unit: str, daily_value_pct: num });

const analysisSchema = z.object({
  is_food: z.boolean().catch(true),
  name: str,
  description: str,
  confidence: num.transform((n) => Math.min(1, Math.max(0, n))),
  portion: str,
  items: z.array(z.object({ name: str, estimated_grams: num, calories: num })).catch([]),
  health_score: num.transform((n) => Math.min(100, Math.max(0, Math.round(n)))),
  health_summary: str,
  calories: num,
  protein_g: num,
  carbs_g: num,
  fat_g: num,
  fiber_g: num,
  sugar_g: num,
  sodium_mg: num,
  saturated_fat_g: num,
  vitamins: z.array(nutrient).catch([]),
  minerals: z.array(nutrient).catch([]),
  tags: z.array(z.string()).catch([]),
  alternatives: z.array(z.object({ name: str, why: str, calories: num })).catch([]),
  recipes: z
    .array(
      z.object({
        title: str,
        time_minutes: num,
        ingredients: z.array(z.string()).catch([]),
        steps: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
});

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Unsupported image. Please upload a JPG or PNG photo.");
  return { mimeType: match[1]!, data: match[2]! };
}

/** Extracts the JSON object from a model reply, tolerating markdown fences or stray prose. */
export function parseAnalysis(text: string): FoodAnalysis {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Couldn't read the analysis. Please try again.");
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Couldn't read the analysis. Please try again.");
  }
  const parsed = analysisSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Couldn't read the analysis. Please try again.");
  return parsed.data;
}

function friendlyError(status: number, body: string): string {
  if (status === 429) return "The free AI quota is used up for now. Wait a minute (or until tomorrow) and try again.";
  if (status === 401 || status === 403) return "The AI key was rejected. Check GEMINI_API_KEY in your environment settings.";
  if (status === 404) return "The configured Gemini model was not found. Check GEMINI_MODEL.";
  if (status === 503) return "The AI service is busy right now. Please try again in a moment.";
  try {
    const message = JSON.parse(body)?.error?.message;
    if (typeof message === "string" && message) return message;
  } catch {
    /* fall through */
  }
  return "Analysis failed. Please try again.";
}

type AnalyzeOptions = {
  image: string;
  note?: string | undefined;
  apiKey: string;
  model?: string | undefined;
  fetchImpl?: typeof fetch;
};

export async function analyzeWithGemini({
  image,
  note,
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  fetchImpl = fetch,
}: AnalyzeOptions): Promise<FoodAnalysis> {
  const { mimeType, data } = parseDataUrl(image);
  const prompt = FOOD_PROMPT + (note ? `\nUser note: ${note}` : "");

  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Gemini error", res.status, body.slice(0, 500));
    throw new Error(friendlyError(res.status, body));
  }

  const json = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  } | null;

  if (json?.promptFeedback?.blockReason) throw new Error("The AI declined to analyze this image.");
  const candidate = json?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    throw new Error(
      candidate?.finishReason === "SAFETY"
        ? "The AI declined to analyze this image."
        : "Couldn't read the analysis. Please try again.",
    );
  }
  return parseAnalysis(text);
}
