import './globals.css';

export const metadata = {
  title: 'Reporte de seguimiento · ControlPeso',
  description:
    'Breve reporte de seguimiento de la Doctora Flor. Solo opciones, menos de 2 minutos.',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
