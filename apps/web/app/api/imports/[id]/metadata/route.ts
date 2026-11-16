import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(
  request: NextRequest,
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
    const body = await request.json();

    const response = await fetch(
      `${API_BASE_URL}/imports/${encodeURIComponent(id)}/metadata`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to apply batch metadata." },
      { status: 502 },
    );
  }
}