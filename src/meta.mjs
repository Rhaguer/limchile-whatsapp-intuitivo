export function graphBase(version) {
  return `https://graph.facebook.com/${encodeURIComponent(version)}`;
}

export async function getMedia(mediaId, cfg) {
  const metaRes = await fetch(`${graphBase(cfg.graphVersion)}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` }
  });
  if (!metaRes.ok) throw new Error(`Meta media metadata HTTP ${metaRes.status}`);
  const metadata = await metaRes.json();
  if (!metadata.url) throw new Error("Meta no entregó URL del audio");

  const mediaRes = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` }
  });
  if (!mediaRes.ok) throw new Error(`Meta media download HTTP ${mediaRes.status}`);

  return {
    bytes: await mediaRes.arrayBuffer(),
    mimeType: metadata.mime_type || mediaRes.headers.get("content-type") || "audio/ogg",
  };
}

async function sendPayload(to, payload, cfg) {
  const res = await fetch(`${graphBase(cfg.graphVersion)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...payload
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

export function sendText(to, body, cfg) {
  return sendPayload(to, { type: "text", text: { preview_url: true, body } }, cfg);
}

export function sendButtons(to, body, buttons, cfg) {
  const safeButtons = buttons.slice(0, 3).map((b, i) => ({
    type: "reply",
    reply: {
      id: String(b.id).slice(0, 256),
      title: String(b.title).slice(0, 20) || `Opción ${i + 1}`
    }
  }));

  return sendPayload(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: { buttons: safeButtons }
    }
  }, cfg);
}
