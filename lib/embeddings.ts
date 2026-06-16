import { ai, EMBED_MODEL } from './gemini';

const MAX_EMBED_CHARS = 8000;

function truncate(text: string): string {
  return text.length > MAX_EMBED_CHARS ? text.slice(0, MAX_EMBED_CHARS) : text;
}

export async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: truncate(text),
    config: { outputDimensionality: 768 },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== 768) {
    throw new Error(`Unexpected embedding dimensions: ${values?.length ?? 0}`);
  }
  return values;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Gemini embedContent accepts a single string or array of strings
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: texts.map(truncate),
    config: { outputDimensionality: 768 },
  });

  const embeddings = response.embeddings;
  if (!embeddings || embeddings.length !== texts.length) {
    // Fallback: embed one by one if batch returns unexpected count
    return Promise.all(texts.map(embedText));
  }

  return embeddings.map((e, i) => {
    const vals = e.values;
    if (!vals || vals.length !== 768) {
      throw new Error(`Bad embedding at index ${i}: ${vals?.length ?? 0} dims`);
    }
    return vals;
  });
}
