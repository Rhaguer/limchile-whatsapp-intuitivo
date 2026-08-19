import { whatsappConfig } from "../../src/config.mjs";
import { verifyMetaSignature, safeJson } from "../../src/security.mjs";
import { getMedia, sendText } from "../../src/meta.mjs";
import { transcribeAudio } from "../../src/groq.mjs";
import { searchBenefits, getBenefitById } from "../../src/catalog.mjs";
import { replySearch, replyDetail, replyHelp } from "../../src/response.mjs";

const processed = new Map();
const TTL_MS = 15 * 60 * 1000;

function seen(messageId) {
  const now = Date.now();
  for (const [id, ts] of processed) if (now - ts > TTL_MS) processed.delete(id);
  if (processed.has(messageId)) return true;
  processed.set(messageId, now);
  return false;
}

function extractMessages(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      for (const message of change?.value?.messages || []) {
        out.push(message);
      }
    }
  }
  return out;
}

function getText(message) {
  if (message.type === "text") return message.text?.body?.trim() || "";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.id ||
           message.interactive?.list_reply?.id || "";
  }
  return "";
}

async function processMessage(message, cfg) {
  if (!message?.id || !message?.from || seen(message.id)) return;

  const to = message.from;
  let text = getText(message);

  if (message.type === "audio") {
    try {
      const media = await getMedia(message.audio?.id, cfg);
      text = await transcribeAudio(media.bytes, media.mimeType);
    } catch (err) {
      console.error("Audio error:", err);
      await sendText(to, "No pude procesar ese audio. Puedes reenviarlo o escribir la consulta en texto.", cfg);
      return;
    }
  }

  if (!text) {
    await replyHelp(to, cfg);
    return;
  }

  if (text === "SEARCH:HELP") {
    await replyHelp(to, cfg);
    return;
  }

  if (text.startsWith("DETAIL:")) {
    const id = text.slice("DETAIL:".length);
    const found = await getBenefitById(id, to);
    if (!found) {
      await sendText(to, "Ese contenido ya no está disponible o no corresponde al perfil actual.", cfg);
      return;
    }
    await replyDetail(to, found.item, found.profile, cfg);
    return;
  }

  const result = await searchBenefits(text, to);
  await replySearch(to, result, cfg);
}

export const handler = async (event) => {
  let cfg;
  try {
    cfg = whatsappConfig();
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Configuración incompleta" };
  }

  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === cfg.verifyToken) {
      return { statusCode: 200, body: q["hub.challenge"] || "" };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8");

  const signature = event.headers?.["x-hub-signature-256"] || event.headers?.["X-Hub-Signature-256"];
  if (!verifyMetaSignature(rawBody, signature, cfg.appSecret)) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  const payload = safeJson(rawBody.toString("utf8"));
  if (!payload) return { statusCode: 400, body: "Invalid JSON" };

  // Meta espera una confirmación rápida. Este prototipo procesa dentro de la
  // función; para alto volumen conviene encolar el trabajo y responder 200 de inmediato.
  try {
    const messages = extractMessages(payload);
    for (const message of messages) await processMessage(message, cfg);
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Se responde 200 para evitar tormentas de reintentos por errores internos no transitorios.
  }

  return { statusCode: 200, body: "EVENT_RECEIVED" };
};
