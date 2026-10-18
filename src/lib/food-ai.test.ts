import { describe, expect, it, vi } from "vitest";
import { analyzeWithGemini, parseAnalysis, parseDataUrl } from "./food-ai";

const image = "data:image/jpeg;base64,AAAA";
const reply = (obj: unknown, init?: ResponseInit) => new Response(JSON.stringify(obj), init);
const candidate = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe("parseDataUrl", () => {
  it("splits mime type and payload", () => {
    expect(parseDataUrl(image)).toEqual({ mimeType: "image/jpeg", data: "AAAA" });
  });
  it("rejects non-base64 input", () => {
    expect(() => parseDataUrl("data:image/png,abc")).toThrow(/Unsupported image/);
  });
});

describe("parseAnalysis", () => {
  it("accepts fenced JSON and fills missing fields with safe defaults", () => {
    const out = parseAnalysis('```json\n{"name":"Apple","calories":"95","health_score":142.4,"confidence":3}\n```');
    expect(out.name).toBe("Apple");
    expect(out.calories).toBe(95);
    expect(out.health_score).toBe(100);
    expect(out.confidence).toBe(1);
    expect(out.vitamins).toEqual([]);
    expect(out.recipes).toEqual([]);
  });
  it("throws on non-JSON", () => {
    expect(() => parseAnalysis("sorry")).toThrow(/Couldn't read/);
  });
});

describe("analyzeWithGemini", () => {
  it("sends the image to Gemini with the API key header", async () => {
    const fetchImpl = vi.fn(async () => reply(candidate('{"name":"Salad","is_food":true,"calories":120}')));
    const out = await analyzeWithGemini({ image, note: "no dressing", apiKey: "k", model: "m", fetchImpl });
    expect(out.name).toBe("Salad");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/m:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: "image/jpeg", data: "AAAA" });
    expect(body.contents[0].parts[0].text).toContain("no dressing");
  });

  it("maps quota errors to a friendly message", async () => {
    const fetchImpl = vi.fn(async () => reply({ error: { message: "quota" } }, { status: 429 }));
    await expect(analyzeWithGemini({ image, apiKey: "k", fetchImpl })).rejects.toThrow(/quota/i);
  });

  it("reports blocked prompts", async () => {
    const fetchImpl = vi.fn(async () => reply({ promptFeedback: { blockReason: "SAFETY" } }));
    await expect(analyzeWithGemini({ image, apiKey: "k", fetchImpl })).rejects.toThrow(/declined/);
  });
});
