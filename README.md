# LimChile — WhatsApp Bienestar intuitivo

Prototipo funcional para recibir texto o audio por WhatsApp y responder únicamente con contenido existente en el catálogo de Bienestar.

## Flujo

WhatsApp -> Webhook -> texto/audio -> Groq Whisper si es audio -> búsqueda determinística/semántica -> catálogo publicado -> elegibilidad -> respuesta WhatsApp.

La IA no redacta beneficios libres. Solo puede seleccionar IDs existentes en el catálogo; después el backend construye la respuesta desde los datos estructurados.

## Incluye

- Verificación del webhook de Meta.
- Validación HMAC SHA-256 de `X-Hub-Signature-256`.
- Recepción de mensajes de texto.
- Recepción y descarga de audio desde Meta.
- Transcripción en español con Groq Whisper.
- Búsqueda tolerante a sinónimos: dental/dentista/dientes/muela, óptica/lentes/anteojos, etc.
- Selección semántica opcional con Groq, limitada a IDs reales del catálogo.
- Respuestas con botones.
- Validación de estado `published`, vigencia y reglas básicas de elegibilidad.
- Adaptador para `BENEFITS_API_URL`.
- Adaptador opcional para `PROFILE_API_URL`.
- Catálogo DEMO inequívocamente marcado cuando no existe API real.
- Sin API keys embebidas.

## Variables Netlify

Copiar las variables de `.env.example` a Netlify > Site configuration > Environment variables.

Obligatorias para WhatsApp:
- `META_VERIFY_TOKEN`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_APP_SECRET`
- `META_GRAPH_API_VERSION`

Obligatoria para audio:
- `GROQ_API_KEY`

Recomendadas:
- `BENEFITS_API_URL`
- `PROFILE_API_URL`
- `INTERNAL_API_TOKEN`

## Endpoint

Después del deploy:

`https://TU-SITIO.netlify.app/api/whatsapp`

Configurar esa URL como callback del webhook de WhatsApp/Meta y usar exactamente el mismo `META_VERIFY_TOKEN`.

## Contrato mínimo de BENEFITS_API_URL

Puede devolver un array directamente o:

```json
{
  "items": [
    {
      "id": "beneficio-123",
      "type": "beneficio",
      "title": "Nombre real",
      "category": "Salud dental",
      "tags": ["dental", "odontologia", "dentista"],
      "summary": "Descripción oficial",
      "coverage": "Región Metropolitana",
      "requirements": ["Requisito oficial"],
      "status": "published",
      "startAt": "2026-01-01T00:00:00-03:00",
      "endAt": "2026-12-31T23:59:59-03:00",
      "url": "https://bienestar-lim.netlify.app/...",
      "eligibility": {
        "regions": ["Región Metropolitana"],
        "contractTypes": ["indefinido"],
        "minSeniorityMonths": 3,
        "installations": []
      }
    }
  ]
}
```

## PROFILE_API_URL

Se consulta como:

`PROFILE_API_URL?phone=569XXXXXXXX`

Ejemplo de respuesta:

```json
{
  "region": "Región Metropolitana",
  "contractType": "indefinido",
  "seniorityMonths": 12,
  "installation": "Instalación X"
}
```

Si no se configura, el bot no afirma que el beneficio sea personalizado; solo informa publicaciones vigentes encontradas.

## Prueba local del motor de búsqueda

```bash
npm run test:intent
```

No requiere Meta ni Groq para los ejemplos cubiertos por reglas locales.

## Ejemplo esperado

Trabajador envía audio:
“Hola, ¿hay algún beneficio dental?”

El sistema:
1. Descarga el audio desde Meta.
2. Lo transcribe.
3. Busca contenido publicado.
4. Aplica perfil si existe.
5. Responde con el beneficio encontrado.
6. Si no existe en el catálogo, informa que no encontró un resultado. No inventa uno.

## Seguridad

- Nunca colocar tokens o API keys en frontend.
- Mantener `META_APP_SECRET` y `META_ACCESS_TOKEN` solo en variables de entorno.
- Rotar inmediatamente cualquier credencial que haya sido expuesta.
- En producción, reemplazar la deduplicación en memoria por idempotencia persistente (DB/Redis).
- Para mayor volumen, responder el webhook rápidamente y procesar mensajes mediante cola.
- El acceso a `BENEFITS_API_URL` y `PROFILE_API_URL` debe ser server-to-server.
- El número telefónico no debe utilizarse como único factor de autorización para información sensible.

## Limitaciones de este paquete

Este ZIP no puede registrar por sí solo un número en Meta ni crear credenciales de WhatsApp Business. Esas credenciales se obtienen desde la cuenta autorizada de Meta y se configuran como variables de entorno.

El catálogo incluido es DEMO. No representa beneficios reales de LimChile. Para operación real debe configurarse `BENEFITS_API_URL`.
