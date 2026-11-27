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
      `${API_BASE_URL}/imports/${encodeURIComponent(id)}/duplicate-review`,
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

    const responseText = await response.text();

    let result: unknown;

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: `Duplicate review API returned a non-JSON response. HTTP ${response.status}.`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "Unable to review duplicate import rows.",
      },
      { status: 502 },
    );
  }
}