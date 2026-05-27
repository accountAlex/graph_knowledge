import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <div className="pb-16 sm:pb-0">
              <PageTransition>{children}</PageTransition>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
