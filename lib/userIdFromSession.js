// lib/userIdFromSession.js

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/authOptions";

// ✅ Returns the Supabase UUID you store in NextAuth JWT
export async function getUserIdFromSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { userId: null };
  }

  return { userId: session.user.id };
}
