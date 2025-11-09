import { supabaseAdmin } from "./supabaseAdmin";
import { getServerSession } from "next-auth";

export async function getUserIdFromSession(authOptions) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { userId: null, email: null };
  const email = session.user.email;

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1, email });
  if (error) return { userId: null, email };
  const user = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  return { userId: user?.id || null, email };
}
