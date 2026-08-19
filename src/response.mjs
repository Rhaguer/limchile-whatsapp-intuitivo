import { sendButtons, sendText } from "./meta.mjs";

function line(label, value) {
  return value ? `${label}: ${value}` : "";
}

export function formatDetail(item, personalized = false) {
  const req = Array.isArray(item.requirements) ? item.requirements.filter(Boolean) : [];
  const chunks = [
    item.demo ? "REGISTRO DE DEMOSTRACIÓN" : "",
    `*${item.title}*`,
    item.summary || "",
    line("Categoría", item.category),
    line("Cobertura", item.coverage),
    req.length ? `Requisitos:\n• ${req.join("\n• ")}` : "",
    personalized ? "Resultado filtrado según el perfil disponible del colaborador." : "",
    item.url ? `Más información: ${item.url}` : ""
  ];
  return chunks.filter(Boolean).join("\n\n");
}

export async function replySearch(to, result, cfg) {
  const items = result.items || [];
  if (!items.length) {
    return sendText(
      to,
      "No encontré un beneficio, convenio o campaña publicada que coincida con esa consulta. Puedes intentarlo con otra forma de decirlo, por ejemplo: “dentista”, “óptica”, “beneficio por nacimiento” o “campañas disponibles”.",
      cfg
    );
  }

  if (items.length === 1) {
    const item = items[0];
    const text = formatDetail(item, Boolean(result.profile));
    return sendButtons(to, text, [
      { id: `DETAIL:${item.id}`, title: "Ver detalle" },
      { id: "SEARCH:HELP", title: "Otra consulta" }
    ], cfg);
  }

  const preview = items.slice(0, 3).map((x, i) => `${i + 1}. ${x.title}`).join("\n");
  const buttons = items.slice(0, 3).map((x, i) => ({
    id: `DETAIL:${x.id}`,
    title: `Ver ${i + 1}`
  }));
  return sendButtons(
    to,
    `Encontré ${items.length} resultados publicados relacionados:\n\n${preview}\n\nSelecciona uno para ver el detalle.`,
    buttons,
    cfg
  );
}

export async function replyDetail(to, item, profile, cfg) {
  return sendText(to, formatDetail(item, Boolean(profile)), cfg);
}

export function replyHelp(to, cfg) {
  return sendText(
    to,
    "Escríbeme o envíame un audio con lo que necesitas. Ejemplos:\n\n• ¿Hay algún beneficio dental?\n• Necesito descuento para lentes\n• ¿Qué beneficios de salud existen?\n• ¿Hay campañas vigentes?\n\nResponderé únicamente con publicaciones existentes en el catálogo de Bienestar.",
    cfg
  );
}
