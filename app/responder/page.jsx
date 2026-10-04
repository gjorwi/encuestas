'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getQuestions, submitSurvey, pingOpen } from '../../lib/api';

const SLIDE_MS = 300;

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return dateStr || '';
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ResponderPage() {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('loading'); // loading|welcome|quiz|submitting|done|error
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [textDraft, setTextDraft] = useState('');
  const [phase, setPhase] = useState('in');

  const questions = useMemo(() => meta?.questions || [], [meta]);
  const current = questions[index];
  const total = questions.length;

  const load = useCallback(async (t) => {
    setStatus('loading');
    setError(null);
    const res = await getQuestions(t);
    if (res.ok) {
      setMeta(res.data);
      if (res.data?.alreadyCompleted) {
        setStatus('done');
        return;
      }
      pingOpen(t);
      setStatus('welcome');
    } else {
      setError(res.error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t');
    if (!t) {
      setError({
        code: 'INVALID_TOKEN',
        title: 'Enlace incompleto',
        text: 'No encontramos tu enlace de reporte. Abre el correo de nuevo o pide uno nuevo a tu médica.',
        retryable: false,
      });
      setStatus('error');
      return;
    }
    setToken(t);
    load(t);
  }, [load]);

  // El borrador del comentario pertenece a la pregunta actual: al cambiar de
  // pregunta restauramos lo que ya se hubiera respondido (o vacío).
  useEffect(() => {
    const q = questions[index];
    if (q?.type === 'text') setTextDraft(answers[q.id] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const start = () => {
    setIndex(0);
    setPhase('in');
    setStatus('quiz');
  };

  const submitAll = useCallback(
    async (finalAnswers) => {
      if (!token) return;
      setStatus('submitting');
      const payload = Object.entries(finalAnswers).map(([questionId, value]) => ({ questionId, value }));
      const res = await submitSurvey(token, payload);
      if (res.ok || res.error?.code === 'ALREADY_ANSWERED') {
        setStatus('done');
      } else {
        setError(res.error);
        setStatus('error');
      }
    },
    [token]
  );

  const advance = useCallback(
    (questionId, value) => {
      if (phase === 'out') return;
      const next = { ...answers, [questionId]: value };
      setAnswers(next);
      setPhase('out');
      setTimeout(() => {
        if (index + 1 >= total) {
          submitAll(next);
        } else {
          setIndex((i) => i + 1);
          setPhase('in');
        }
      }, SLIDE_MS);
    },
    [answers, index, total, phase, submitAll]
  );

  const back = () => {
    if (index === 0) {
      setStatus('welcome');
      return;
    }
    setIndex((i) => i - 1);
    setPhase('in');
  };

  const retryError = () => {
    if (!token || error?.retryable === false) return;
    if (error?.code === 'SERVER_ERROR' || error?.retryable) {
      if (Object.keys(answers).length && total > 0 && index >= total - 1) {
        submitAll(answers);
        return;
      }
      load(token);
      return;
    }
    load(token);
  };

  // Cerrar la pestaña: window.close() no funciona si la pestaña no fue abierta
  // por script (típico al abrir el enlace desde una app de correo), así que
  // caemos al historial del navegador.
  const closeTab = () => {
    try {
      window.close();
    } catch (_) {}
    setTimeout(() => {
      if (!window.closed) {
        try {
          window.history.back();
        } catch (_) {}
      }
    }, 150);
  };

  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const pct = total ? Math.min(100, Math.round((answeredCount / total) * 100)) : 0;

  if (status === 'loading') {
    return (
      <Shell>
        <div className="card">
          <div className="spinner" />
          <p className="heroText" style={{ textAlign: 'center' }}>
            Cargando tu reporte…
          </p>
        </div>
        <Footer />
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
        <div className="card">
          <div className="errorIcon">⚠️</div>
          <div className="hero">
            <h1 className="heroTitle">{error?.title || 'No se pudo cargar'}</h1>
            <p className="heroText">{error?.text || 'Intenta de nuevo en unos minutos.'}</p>
          </div>
          <div className="actions">
            {error?.retryable !== false ? (
              <button className="btn btnPrimary" onClick={retryError}>
                Intentar de nuevo
              </button>
            ) : null}
            <button className="btn btnGhost" onClick={() => window.history.back()}>
              Volver al correo
            </button>
          </div>
        </div>
        <Footer />
      </Shell>
    );
  }

  if (status === 'done') {
    const name = meta?.patientFirstName || '';
    const summary = questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => {
        if (q.type === 'text') return { q: q.text, a: answers[q.id] };
        const opt = (q.options || []).find((o) => o.value === answers[q.id]);
        return { q: q.text, a: opt?.label || answers[q.id] };
      });
    return (
      <Shell>
        <div className="card">
          <div className="doneIcon">✅</div>
          <div className="hero">
            <h1 className="heroTitle">{name ? `¡Gracias, ${name}!` : '¡Gracias!'}</h1>
            <p className="heroText">
              Ya recibimos tu reporte. La Doctora Flor lo revisará y, si hay algo que atender, se
              pondrá en contacto contigo.
            </p>
          </div>
          {summary.length > 0 ? (
            <ul className="summaryList">
              {summary.map((s) => (
                <li key={s.q}>
                  <span className="summaryQ">{s.q}</span>
                  <span className="summaryA">{s.a}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="actions">
            <button className="btn btnPrimary" onClick={closeTab}>
              Cerrar
            </button>
          </div>
        </div>
        <Footer />
      </Shell>
    );
  }

  if (status === 'welcome') {
    const name = meta?.patientFirstName;
    return (
      <Shell>
        <div className="card">
          <div className="hero">
            <div className="heroEmoji">💬</div>
            <h1 className="heroTitle">{name ? `Hola, ${name}` : 'Hola'}</h1>
            <p className="heroText">
              Soy la <strong>Doctora Flor</strong>. Espero que te encuentres muy bien. Te pido
              amablemente que completes tu reporte de seguimiento: son breves preguntas de opción
              múltiple, sin necesidad de escribir, y toma menos de 2 minutos.
            </p>
            <span className="pill">📝 {total} preguntas · 2 minutos</span>
            {meta?.date ? <p className="expiry">Reporte del {formatDateLabel(meta.date)}</p> : null}
          </div>
          <div className="actions">
            <button className="btn btnPrimary" onClick={start}>
              Comenzar
            </button>
          </div>
        </div>
        <Footer />
      </Shell>
    );
  }

  if (status === 'submitting') {
    return (
      <Shell>
        <div className="card">
          <div className="spinner" />
          <p className="heroText" style={{ textAlign: 'center' }}>
            Enviando tu reporte…
          </p>
        </div>
        <Footer />
      </Shell>
    );
  }

  // status === 'quiz'
  if (!current) {
    // Configuración sin preguntas: no dejar al paciente en un spinner eterno.
    return (
      <Shell>
        <div className="card">
          <div className="errorIcon">⚠️</div>
          <div className="hero">
            <h1 className="heroTitle">Este reporte no tiene preguntas</h1>
            <p className="heroText">Pídele a tu médica que te envíe uno nuevo.</p>
          </div>
          <div className="actions">
            <button className="btn btnGhost" onClick={() => window.history.back()}>
              Volver al correo
            </button>
          </div>
        </div>
        <Footer />
      </Shell>
    );
  }

  const isText = current.type === 'text';
  const textOptional = current.required === false;
  const textDisabled = isText && !textOptional && !textDraft.trim();

  return (
    <Shell>
      <div className="card">
        <div className="progressWrap">
          <div className="progressTop">
            <span className="progressLabel">
              Pregunta {index + 1} de {total}
            </span>
            <span className="progressCount">{pct}%</span>
          </div>
          <div className="progressTrack">
            <div className="progressFill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="stage">
          <div key={`${current.id}-${index}`} className={`qcard${phase === 'out' ? ' out' : ''}`}>
            <div className="qIndex">
              {isText ? (textOptional ? 'Comentario (opcional)' : 'Comentario') : 'Elige una opción'}
            </div>
            <h2 className="qText">{current.text}</h2>

            {isText ? (
              <>
                <textarea
                  className="textarea"
                  maxLength={current.maxLength || 300}
                  placeholder={current.placeholder || (textOptional ? 'Escribe aquí (opcional)' : 'Escribe aquí')}
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  autoFocus
                />
                <div className="textHint">
                  {textOptional ? 'Puedes dejarlo vacío y continuar.' : 'Este comentario es obligatorio para enviar el reporte.'}
                </div>
                <div className="actions">
                  <button
                    className={`btn btnPrimary${textDisabled ? ' btnDisabled' : ''}`}
                    onClick={() => {
                      if (textDisabled) return;
                      advance(current.id, textDraft.trim());
                    }}
                  >
                    {index + 1 >= total ? 'Enviar reporte' : 'Continuar'}
                  </button>
                  {index > 0 ? (
                    <button className="btn btnGhost" onClick={back}>
                      ← Anterior
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="options">
                {(current.options || []).map((opt) => (
                  <button
                    key={opt.value}
                    className={`option${answers[current.id] === opt.value ? ' selected' : ''}`}
                    onClick={() => advance(current.id, opt.value)}
                  >
                    <span className="optionMark">{answers[current.id] === opt.value ? '✓' : ''}</span>
                    {opt.label}
                  </button>
                ))}
                {index > 0 ? (
                  <button className="btn btnGhost" onClick={back}>
                    ← Anterior
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="shell">
      <div className="brand">
        <div className="brandDot">CP</div>
        <div>
          <div className="brandTitle">ControlPeso</div>
          <div className="brandSubtitle">Reporte de seguimiento</div>
        </div>
      </div>
      {children}
    </main>
  );
}

function Footer() {
  return <p className="footer">ControlPeso · Seguimiento de la Doctora Flor</p>;
}

