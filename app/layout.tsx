import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { BetaStrip } from "@/components/BetaStrip";
import { NavProgress } from "@/components/NavProgress";

// One font pair: IBM Plex Sans for text, IBM Plex Mono for numbers and labels.
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Cue Card Generator",
  description: "Turn lecture scripts into HackMD cue cards.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint so a saved Light/Dark choice never flashes the other theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <NavProgress />
        <div className="flex min-h-screen flex-col">
          <BetaStrip />
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
