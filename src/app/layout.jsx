import { Plus_Jakarta_Sans } from "next/font/google";

import { ClerkProvider } from "@clerk/nextjs";

import { site } from "@/config/site";
import { ServiceWorker } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/** One rounded, friendly sans for the whole site — body, headings, codes and numbers alike (chosen by the owner from a side-by-side comparison). */
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata = {
  title: {
    default: `${site.name} — ${site.edition}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // Installed on an iPhone home screen: full screen, app name under the icon.
  appleWebApp: { capable: true, title: "CA Compliance", statusBarStyle: "black-translucent" },
};

/** Colours the installed app's title bar and the phone's status bar. */
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12131f" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Accounts (sign up, sign in) are handled by Clerk; nothing about users is stored by this app. */}
        <ClerkProvider
          // Clerk's styles sit in their own CSS layer, below the site's, so CA Compliance Tool's styling wins.
          appearance={{ cssLayerName: "clerk" }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/sign-in"
        >
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {children}
            <Toaster position="bottom-right" />
            <ServiceWorker />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
