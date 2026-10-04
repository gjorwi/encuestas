import { redirect } from 'next/navigation';

// El correo apunta a /responder?t=...; esta raíz redirige por comodidad y
// muestra un mensaje si llega alguien sin enlace.
export default function Home({ searchParams }) {
  const t = searchParams?.t;
  if (t) {
    redirect(`/responder?t=${encodeURIComponent(t)}`);
  }

  return (
    <main className="shell">
      <div className="brand">
        <div className="brandDot">CP</div>
        <div>
          <div className="brandTitle">ControlPeso</div>
          <div className="brandSubtitle">Reporte de seguimiento</div>
        </div>
      </div>
      <div className="card">
        <div className="hero">
          <div className="heroEmoji">📋</div>
          <h1 className="heroTitle">Reporte de seguimiento</h1>
          <p className="heroText">
            Abre el enlace que te enviamos por correo para responder tu reporte. Si no lo tienes,
            revisa tu bandeja de entrada o carpeta de spam.
          </p>
        </div>
      </div>
      <p className="footer">ControlPeso · Seguimiento de la Doctora Flor</p>
    </main>
  );
}
