import { getSession } from "next-auth/react";
import axios from "axios";

export async function getGoogleAccessToken(req) {
  const session = await getSession({ req });
  if (!session) return null;

  // NextAuth stores access token in session
  return session.accessToken || null;
}
