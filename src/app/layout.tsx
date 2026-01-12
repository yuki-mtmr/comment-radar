import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { LanguageProvider } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "CommentRadar - YouTube Comment Sentiment Analysis",
  description: "Analyze YouTube video comments with AI-powered sentiment analysis. Visualize viewer reactions and discover patterns in comment sentiment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <ErrorBoundary>
              <header className="fixed top-0 left-0 right-0 z-50 glass-dark">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                  <h1 className="text-2xl font-bold gradient-text">CommentRadar</h1>
                  <LanguageSwitcher />
                </div>
              </header>
              <main className="container mx-auto px-4 pt-24 pb-12">
                {children}
              </main>
              <Toaster />
            </ErrorBoundary>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
