import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      // Require the user to be logged in for all routes by default
      if (req.nextUrl.pathname.startsWith("/login")) {
        return true; // Don't redirect if already on login page
      }
      return !!token;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Apply middleware to all routes except api, _next, static files, and login
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
