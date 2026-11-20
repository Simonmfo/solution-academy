import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solution Academy | Campus Virtual Oficial",
  description:
    "Campus Virtual oficial de Solution Academy. Formación técnica en Operación de Maquinaria Pesada, Construcción y Oficios, Soldadura e Industria con diplomas verificables por QR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
