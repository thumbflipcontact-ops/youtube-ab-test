import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function saveRefreshToken(email, refreshToken) {
  if (!refreshToken) return; // ❗ Do NOT overwrite with undefined or null

  await supabaseAdmin
    .from("app_users")
    .update({ refresh_token: refreshToken })
    .eq("email", email);
}

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

    // ❗ Google may return a NEW refresh token
    const newRefreshToken = refreshed.refresh_token ?? token.refreshToken;

    // ❗ Always persist refreshed tokens to DB
    await saveRefreshToken(token.email, newRefreshToken);

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: newRefreshToken,
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
      // FIRST LOGIN
      if (account && user) {
        const refreshToken = account.refresh_token ?? token.refreshToken;

        // Save refresh token to DB on first login OR re-login
        await saveRefreshToken(user.email, refreshToken);

        token.email = user.email;
        token.accessToken = account.access_token;
        token.refreshToken = refreshToken;
        token.accessTokenExpires = Date.now() + account.expires_in * 1000;

        return token;
      }

      // TOKEN EXPIRED → REFRESH IT
      if (Date.now() >= token.accessTokenExpires) {
        return refreshAccessToken(token);
      }

      return token;
    },

    async session({ session, token }) {
      session.user.email = token.email;
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.error = token.error;
      return session;
    },
  },
};
