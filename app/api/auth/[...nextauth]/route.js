// /api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// --- Initialize Supabase admin client ---
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Helper: refresh expired Google access tokens ---
async function refreshAccessToken(token) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    console.log(`🔁 Refreshed Google access token for ${token.email || "user"}`);

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000, // 1 hour
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // keep old if new one not returned
    };
  } catch (error) {
    console.error("❌ Error refreshing access token:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// --- NextAuth configuration ---
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
          access_type: "offline", // get refresh_token
          prompt: "consent",
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    /**
     * 🧠 Handles JWT creation and token refresh
     */
    async jwt({ token, account, user }) {
      // Initial sign-in
      if (account && user) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = Date.now() + account.expires_in * 1000;
        token.email = user.email;
        token.name = user.name;
        return token;
      }

      // Still valid
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Expired → refresh
      return await refreshAccessToken(token);
    },

    /**
     * 💾 Add token fields to session
     */
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.user.email = token.email;
      session.user.name = token.name;
      session.error = token.error;
      return session;
    },

    /**
     * 🔐 Save refresh_token & user info to Supabase
     */
    async signIn({ user, account }) {
      try {
        if (account?.refresh_token) {
          const { error } = await supabaseAdmin
            .from("app_users")
            .upsert(
              {
                email: user.email,
                name: user.name,
                image: user.image,
                google_id: account.providerAccountId,
                refresh_token: account.refresh_token,
                updated_at: new Date().toISOString(),
              },
              { onConflict: ["email"] }
            );

          if (error) throw error;
          console.log(`✅ Saved/updated user in Supabase: ${user.email}`);
        }
      } catch (err) {
        console.error("❌ Failed to save user in Supabase:", err);
      }

      return true;
    },
  },
};

export default NextAuth(authOptions);
