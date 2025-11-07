// app/api/tests/user/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import handler from "../../auth/[...nextauth]/route";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  try {
    // ✅ Authentication (App Router)
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // ✅ Use Supabase admin client (bypass RLS safely)
    const { data, error } = await supabaseAdmin
      .from("ab_tests")
      .select(
        "id, video_id, start_datetime, end_datetime, analytics_collected"
      )
      .eq("user_email", userEmail)
      .order("start_datetime", { ascending: false });

    if (error) {
      console.error("❌ Failed to fetch user tests:", error);
      return NextResponse.json(
        { message: "Failed to fetch tests" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tests: data }, { status: 200 });
  } catch (err) {
    console.error("❌ Error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
