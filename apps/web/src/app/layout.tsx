import "./globals.css";
import type { Metadata } from "next";
import { Inter, Unbounded } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { CommandPalette } from "@/components/CommandPalette";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MathWin — Центр подготовки по математике",
  description:
    "MathWin — подготовка к ОГЭ и ЕГЭ по математике на графе знаний. Очно в Дмитрове и онлайн по всей России. Запишитесь на пробное занятие.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      data-theme="dark"
      className={`${inter.variable} ${unbounded.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <CommandPalette />
            <div className="pb-16 sm:pb-0">
              <PageTransition>{children}</PageTransition>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
