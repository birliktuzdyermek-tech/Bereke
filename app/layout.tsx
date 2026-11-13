import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences-provider";

export const metadata: Metadata = {
  title: "Теңгерім — жеке қаржыңыз бір жерде",
  description: "Кіріс пен шығысты талдап, жазылымдарды бақылаңыз және үнемдеу жолдарын табыңыз.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kk">
      <body><PreferencesProvider>{children}</PreferencesProvider></body>
    </html>
  );
}
