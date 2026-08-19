import { groqConfig } from "./config.mjs";

function extensionForMime(mime = "") {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("webm")) return "webm";
  return "ogg";
}

export async function transcribeAudio(arrayBuffer, mimeType) {
  const cfg = groqConfig();
  if (!cfg.apiKey) throw new Error("GROQ_API_KEY no configurada para transcribir audio");

  const form = new FormData();
  const ext = extensionForMime(mimeType);
  form.append("file", new Blob([arrayBuffer], { type: mimeType }), `audio.${ext}`);
  form.append("model", cfg.sttModel);
  form.append("language", "es");
  form.append("response_format", "json");
  form.append("temperature", "0");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form
  });
  if (!res.ok) throw new Error(`Groq STT HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const data = await res.json();
  const text = String(data.text || "").trim();
  if (!text) throw new Error("La transcripción llegó vacía");
  return text;
}

export async function semanticSelect(query, candidates) {
  const cfg = groqConfig();
  if (!cfg.apiKey || candidates.length === 0) return [];

  const compact = candidates.slice(0, 80).map(x => ({
    id: x.id,
    title: x.title,
    type: x.type,
    category: x.category,
    tags: x.tags,
    summary: x.summary
  }));

  const system = [
    "Eres un clasificador de búsqueda para el catálogo corporativo de Bienestar LimChile.",
    "NO respondas la pregunta del trabajador.",
    "NO inventes beneficios.",
    "Solo puedes seleccionar IDs que existan en CANDIDATOS.",
    "Si ningún candidato corresponde, devuelve {\"ids\":[]}.",
    "Acepta sinónimos y lenguaje coloquial chileno, por ejemplo dientes/muela/dentista -> dental/odontología.",
    "Devuelve únicamente JSON válido con el formato {\"ids\":[\"id1\",\"id2\"]}, máximo 5 IDs."
  ].join(" ");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: cfg.textModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `CONSULTA:\n${query}\n\nCANDIDATOS:\n${JSON.stringify(compact)}` }
      ]
    })
  });

  if (!res.ok) return [];
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    const allowed = new Set(candidates.map(c => String(c.id)));
    return Array.isArray(parsed.ids)
      ? parsed.ids.map(String).filter(id => allowed.has(id)).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}
