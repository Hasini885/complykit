import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Every page of the app needs a signed-in account (Clerk). Open to everyone:
 * the public home page ("Never miss an MCA deadline again"), the Privacy
 * Policy and Terms (Google requires them public), and sign-in / sign-up. Entering the app from the home page asks to sign in. Accounts live
 * with Clerk, not in this app: CA Compliance Tool itself stores no user data, and each
 * user's companies stay in their own browser.
 */
// The Razorpay webhook is called by Razorpay, not a signed-in user; it checks its own signature.
const isPublic = createRouteMatcher([
  "/",
  "/privacy",
  "/terms",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/billing/webhook",
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublic(request)) await auth.protect();
  },
  // Signed-out visitors are sent here (not shown a "not found" page).
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    // Every page, but not Next's build files or static assets.
    "/((?!_next|[^?]*.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
