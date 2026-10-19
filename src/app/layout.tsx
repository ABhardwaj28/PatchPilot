import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PatchPilot — AI-Assisted GitHub Issue Investigation & Patch Verification",
  description:
    "An open-source developer tool for investigating public GitHub issues, proposing bounded patches, and verifying fixes in isolated sandboxes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
