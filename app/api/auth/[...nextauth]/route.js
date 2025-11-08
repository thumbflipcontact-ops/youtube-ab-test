import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// ✅ Supabase Admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Refresh Google token when expired
async function refreshAccessToken(token) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    console.error("❌ Error refreshing Google access token:", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// ✅ Main NextAuth config
const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            "openid",
            "profile",
            "email",
            "https://www.googleapis.com/auth/youtube.readonly",
            "https://www.googleapis.com/auth/youtube.upload",
            "https://www.googleapis.com/auth/yt-analytics.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // ✅ JWT callback runs at login and on each request
    async jwt({ token, user, account }) {
      // ✅ First login
      if (account && user) {
        // 1️⃣ Find existing Supabase user
        const { data: existing } = await supabaseAdmin
          .from("app_users")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        let userId;

        if (existing) {
          userId = existing.id;
        } else {
          // 2️⃣ Create Supabase user
          const { data: created, error } = await supabaseAdmin
            .from("app_users")
            .insert({
              email: user.email,
              name: user.name,
              image: user.image,
              google_id: account.providerAccountId,
              refresh_token: account.refresh_token,
            })
            .select("id")
            .single();

          if (error) console.error(error);
          userId = created.id;
        }

        // ✅ Save Supabase UUID in the JWT
        token.userId = userId;

        // ✅ Google tokens
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = Date.now() + account.expires_in * 1000;
        token.email = user.email;
        token.name = user.name;

        return token;
      }

      // ✅ If token expired, refresh it
      if (Date.now() > token.accessTokenExpires) {
        return refreshAccessToken(token);
      }

      return token;
    },

    // ✅ Session callback exposes data to frontend + API routes
    async session({ session, token }) {
      session.user.id = token.userId;  // ✅ REQUIRED FOR API AUTH
      session.user.email = token.email;
      session.user.name = token.name;

      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;

      session.error = token.error;
      return session;
    },
  },
};

// ✅ NextAuth handler for App Router
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
