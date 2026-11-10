
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shikhasetu_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const response = await fetch(
      `${API_BASE_URL}/imports/${encodeURIComponent(id)}/rollback`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to rollback import." },
      { status: 502 },
    );
  }
}
