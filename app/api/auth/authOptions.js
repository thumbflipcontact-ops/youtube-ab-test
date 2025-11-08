import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// ✅ Supabase Admin
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    console.error("❌ Error refreshing token:", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions = {
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
    async jwt({ token, account, user }) {
      if (account && user) {
        // ✅ 1. Check or create Supabase user
        const { data: existing } = await supabaseAdmin
          .from("app_users")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        let userId;

        if (existing) {
          userId = existing.id;
        } else {
          const { data: created } = await supabaseAdmin
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

          userId = created.id;
        }

        // ✅ STORE userId IN TOKEN
        token.userId = userId;

        // ✅ Google OAuth tokens
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = Date.now() + account.expires_in * 1000;

        token.email = user.email;
        return token;
      }

      if (Date.now() < token.accessTokenExpires) return token;

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      // ✅ EXPOSE userId TO SESSION
      session.user.id = token.userId;
      session.user.email = token.email;

      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;

      session.error = token.error;
      return session;
    },
  },
};
