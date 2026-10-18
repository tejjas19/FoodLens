export type Nutrient = { name: string; amount: number; unit: string; daily_value_pct: number };

export type FoodAnalysis = {
  is_food: boolean;
  name: string;
  description: string;
  confidence: number;
  portion: string;
  items: { name: string; estimated_grams: number; calories: number }[];
  health_score: number;
  health_summary: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  vitamins: Nutrient[];
  minerals: Nutrient[];
  tags: string[];
  alternatives: { name: string; why: string; calories: number }[];
  recipes: { title: string; time_minutes: number; ingredients: string[]; steps: string[] }[];
};

export function scoreTone(score: number) {
  if (score >= 75) return "good" as const;
  if (score >= 50) return "ok" as const;
  return "bad" as const;
}

export async function fileToJpegDataUrl(file: File, max = 1024): Promise<{ dataUrl: string; blob: Blob }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const blob = await (await fetch(dataUrl)).blob();
  return { dataUrl, blob };
}
