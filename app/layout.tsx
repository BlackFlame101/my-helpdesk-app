
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; 
import { AuthProvider } from "@/contexts/AuthContext"; 
import { ThemeProvider } from "@/components/theme-provider"; 
import { Toaster } from "@/components/ui/toaster"; 

const inter = Inter({ subsets: ["latin"] });


export const metadata: Metadata = {
  title: "HelpDesk - Ticket Management",
  description: "A ticket management system for customer support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    
    <html lang="en" suppressHydrationWarning>
      {}
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="light" 
            enableSystem 
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
