
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
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
    const query = request.nextUrl.searchParams.toString();

    const response = await fetch(
      `${API_BASE_URL}/imports/${encodeURIComponent(id)}/error-report${query ? `?${query}` : ""}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/octet-stream",
        "Content-Disposition":
          response.headers.get("content-disposition") ??
          'attachment; filename="import-error-report"',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to download error report." },
      { status: 502 },
    );
  }
}
