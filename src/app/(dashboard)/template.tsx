/** Re-mount tiap navigasi; animasi masuk pakai CSS (lebih ringan dari JS). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
