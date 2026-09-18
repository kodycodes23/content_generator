import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/components/content/RoleContext";
import { ErrorBoundary } from "@/components/content/ErrorBoundary";
import { ErrorLogger } from "@/components/content/ErrorLogger";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-article",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Koya Content Ops",
  description: "Content operations and human-in-the-loop publishing dashboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ErrorLogger />
        <ErrorBoundary>
          <RoleProvider>{children}</RoleProvider>
        </ErrorBoundary>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
