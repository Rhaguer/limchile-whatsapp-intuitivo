export function env(name, { required = false, fallback = "" } = {}) {
  const value = (process.env[name] ?? fallback).trim();
  if (required && !value) throw new Error(`Falta variable de entorno: ${name}`);
  return value;
}

export function whatsappConfig() {
  return {
    verifyToken: env("META_VERIFY_TOKEN", { required: true }),
    accessToken: env("META_ACCESS_TOKEN", { required: true }),
    phoneNumberId: env("META_PHONE_NUMBER_ID", { required: true }),
    appSecret: env("META_APP_SECRET", { required: true }),
    graphVersion: env("META_GRAPH_API_VERSION", { required: true }),
  };
}

export function groqConfig() {
  return {
    apiKey: env("GROQ_API_KEY"),
    sttModel: env("GROQ_STT_MODEL", { fallback: "whisper-large-v3-turbo" }),
    textModel: env("GROQ_TEXT_MODEL", { fallback: "openai/gpt-oss-20b" }),
  };
}

export function integrationConfig() {
  return {
    benefitsApiUrl: env("BENEFITS_API_URL"),
    profileApiUrl: env("PROFILE_API_URL"),
    internalApiToken: env("INTERNAL_API_TOKEN"),
    publicSiteUrl: env("PUBLIC_SITE_URL", { fallback: "https://bienestar-lim.netlify.app" }),
  };
}
