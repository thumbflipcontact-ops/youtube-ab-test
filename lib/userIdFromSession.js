import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/authOptions"; // ✅ FIXED PATH

/**
 * Returns userId + email from NextAuth session
 */
export async function getUserIdFromSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { userId: null, email: null };
  }

  return {
    userId: session.user.id,
    email: session.user.email,
  };
}
