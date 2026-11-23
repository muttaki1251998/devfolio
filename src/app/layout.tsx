import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "jiramorning",
  description: "Your Jira morning paper: what you pregroomed, what you handed to QA, and your standup — drafted before you sit down.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
