import { integrationConfig } from "./config.mjs";
import { semanticSelect } from "./groq.mjs";

const DEMO_CATALOG = [
  {
    id: "demo-dental-001",
    demo: true,
    type: "beneficio",
    title: "DEMO — Beneficio Dental",
    category: "Salud dental",
    tags: ["dental", "dentista", "odontologia", "odontologico", "dientes", "muela", "salud bucal"],
    summary: "Registro de demostración para probar consultas por texto o audio. Reemplazar por el catálogo real de Bienestar.",
    coverage: "Demo",
    requirements: ["Sin datos reales: registro exclusivo de prueba"],
    status: "published",
    url: "https://bienestar-lim.netlify.app/"
  },
  {
    id: "demo-optica-001",
    demo: true,
    type: "convenio",
    title: "DEMO — Convenio Óptica",
    category: "Salud visual",
    tags: ["optica", "lentes", "anteojos", "vision", "oftalmologia"],
    summary: "Registro de demostración para comprobar la búsqueda semántica del canal WhatsApp.",
    coverage: "Demo",
    requirements: ["Sin datos reales: registro exclusivo de prueba"],
    status: "published",
    url: "https://bienestar-lim.netlify.app/"
  }
];

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loadCatalog() {
  const cfg = integrationConfig();
  if (!cfg.benefitsApiUrl) return DEMO_CATALOG;

  const res = await fetch(cfg.benefitsApiUrl, {
    headers: { Accept: "application/json", ...authHeaders(cfg.internalApiToken) }
  });
  if (!res.ok) throw new Error(`BENEFITS_API_URL HTTP ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(items)) throw new Error("BENEFITS_API_URL debe devolver un array o {items:[...]}");
  return items;
}

export async function loadProfile(phone) {
  const cfg = integrationConfig();
  if (!cfg.profileApiUrl) return null;
  const url = new URL(cfg.profileApiUrl);
  url.searchParams.set("phone", phone);
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...authHeaders(cfg.internalApiToken) }
  });
  if (!res.ok) return null;
  return res.json();
}

function norm(s = "") {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPublishedAndCurrent(item, now = new Date()) {
  if (String(item.status || "").toLowerCase() !== "published") return false;
  if (item.startAt && new Date(item.startAt) > now) return false;
  if (item.endAt && new Date(item.endAt) < now) return false;
  return true;
}

function eligible(item, profile) {
  if (!profile) return true;
  const rules = item.eligibility || {};

  if (Array.isArray(rules.regions) && rules.regions.length && !rules.regions.includes(profile.region)) return false;
  if (Array.isArray(rules.contractTypes) && rules.contractTypes.length && !rules.contractTypes.includes(profile.contractType)) return false;
  if (Number.isFinite(Number(rules.minSeniorityMonths)) &&
      Number(profile.seniorityMonths || 0) < Number(rules.minSeniorityMonths)) return false;
  if (Array.isArray(rules.installations) && rules.installations.length &&
      !rules.installations.includes(profile.installation)) return false;

  return true;
}

function lexicalScore(query, item) {
  const q = norm(query);
  const hay = norm([
    item.title, item.type, item.category, item.summary,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).join(" "));

  const stop = new Set([
    "hay", "tienen", "tengo", "necesito", "quiero", "busco", "para", "algo",
    "algun", "alguna", "beneficio", "beneficios", "convenio", "convenios",
    "campana", "campanas", "disponible", "disponibles", "limchile", "bienestar"
  ]);
  const terms = q.split(" ").filter(t => t.length >= 3 && !stop.has(t));
  let score = 0;
  for (const t of terms) if (hay.includes(t)) score += 2;

  const synonymGroups = [
    ["dental", "dentista", "odontologia", "odontologico", "diente", "dientes", "muela", "muelas"],
    ["optica", "lente", "lentes", "anteojo", "anteojos", "vision", "oftalmologia"],
    ["psicologia", "psicologo", "salud mental", "apoyo emocional"],
    ["nacimiento", "recien nacido", "bebe", "hijo"],
    ["recreacion", "entrada", "entradas", "parque", "entretencion"]
  ];
  for (const group of synonymGroups) {
    if (group.some(k => q.includes(norm(k))) && group.some(k => hay.includes(norm(k)))) score += 8;
  }
  return score;
}

export async function searchBenefits(query, phone) {
  const [catalog, profile] = await Promise.all([loadCatalog(), loadProfile(phone)]);
  const visible = catalog.filter(x => isPublishedAndCurrent(x) && eligible(x, profile));

  const lexical = visible
    .map(item => ({ item, score: lexicalScore(query, item) }))
    .filter(x => x.score >= 4)
    .sort((a, b) => b.score - a.score);

  if (lexical.length) {
    return { items: lexical.slice(0, 5).map(x => x.item), profile, source: "lexical" };
  }

  const ids = await semanticSelect(query, visible);
  const byId = new Map(visible.map(x => [String(x.id), x]));
  return { items: ids.map(id => byId.get(id)).filter(Boolean), profile, source: "semantic" };
}

export async function getBenefitById(id, phone) {
  const [catalog, profile] = await Promise.all([loadCatalog(), loadProfile(phone)]);
  const item = catalog.find(x => String(x.id) === String(id));
  if (!item || !isPublishedAndCurrent(item) || !eligible(item, profile)) return null;
  return { item, profile };
}
