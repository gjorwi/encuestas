// Cliente de la API del servidor de ControlPeso (Express/Render).
// El front no lleva token: la identificación del paciente es el enlace (t).

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

function mapError(status, data) {
  if (status === 404) {
    return { code: 'NOT_FOUND', title: 'Enlace no válido', text: 'Este enlace no corresponde a ningún reporte. Pide a tu médica uno nuevo.', retryable: false };
  }
  if (status === 410) {
    return { code: 'TOKEN_EXPIRED', title: 'Enlace vencido', text: 'Este enlace ya venció. Pide a tu médica recibir uno nuevo.', retryable: false };
  }
  if (status === 409 && data?.error === 'ALREADY_ANSWERED') {
    return { code: 'ALREADY_ANSWERED', title: 'Ya enviado', text: data?.message || 'Este reporte ya fue enviado. ¡Gracias!' };
  }
  if (status === 400) {
    if (data?.error === 'INVALID_TOKEN') {
      return { code: 'INVALID_TOKEN', title: 'Enlace incompleto', text: data?.message || 'Falta el enlace del reporte. Ábrelo de nuevo desde el correo.', retryable: false };
    }
    return { code: 'INVALID', title: data?.error === 'INVALID_ANSWERS' ? 'Faltan respuestas' : 'No se pudo enviar', text: data?.message || 'Revisa tus respuestas e inténtalo de nuevo.', retryable: true };
  }
  if (status === 429) {
    return { code: 'RATE_LIMIT', title: 'Muchos intentos', text: 'Espera un minuto y vuelve a intentarlo.', retryable: true };
  }
  return {
    code: data?.error || 'SERVER_ERROR',
    title: 'Ups, hubo un problema',
    text: data?.message || 'No se pudo completar la operación. Intenta de nuevo.',
    retryable: true,
  };
}

async function call(path, { method = 'GET', body, timeoutMs = 25000 } = {}) {
  if (!API_URL) {
    return {
      ok: false,
      error: {
        code: 'NO_API_URL',
        title: 'Configuración pendiente',
        text: 'Falta definir NEXT_PUBLIC_API_URL en el despliegue.',
        retryable: false,
      },
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (res.ok) return { ok: true, data, status: res.status };
    return { ok: false, data, status: res.status, error: mapError(res.status, data) };
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    return {
      ok: false,
      error: {
        code: aborted ? 'TIMEOUT' : 'NETWORK',
        title: aborted ? 'Sin respuesta' : 'Sin conexión',
        text: aborted
          ? 'El servidor tardó demasiado. Revisa tu conexión e intenta de nuevo.'
          : 'No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.',
        retryable: true,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getQuestions(token) {
  return call(`/api/survey/questions?t=${encodeURIComponent(token)}`);
}

export function submitSurvey(token, answers) {
  return call('/api/survey/submit', {
    method: 'POST',
    body: { t: token, answers },
    timeoutMs: 40000,
  });
}

// Métrica de apertura del enlace (mejor esfuerzo, sin bloquear la UI).
export function pingOpen(token) {
  if (!API_URL || !token) return;
  try {
    fetch(`${API_URL}/api/survey/open?t=${encodeURIComponent(token)}`, { cache: 'no-store' }).catch(() => {});
  } catch (_) {}
}
