import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DAM Browser",
  description: "Digital Asset Management Browser",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} bg-slate-50 text-slate-900 flex flex-col h-full`}>
        <AuthProvider>
          <Nav />
          <main className="flex-1 overflow-hidden">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
