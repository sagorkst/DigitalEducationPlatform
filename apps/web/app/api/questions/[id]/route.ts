
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("shikhasetu_session")?.value;
}

async function forwardRequest(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "PUT" | "DELETE",
) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "প্রথমে লগইন করুন।" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Question ID প্রয়োজন।" },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    const options: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    if (method === "PUT") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(await request.json());
    }

    const apiResponse = await fetch(
      `${API_BASE_URL}/questions/${encodeURIComponent(id)}`,
      options,
    );

    const result = await apiResponse.json();

    return NextResponse.json(result, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Questions API-তে সংযোগ করা যাচ্ছে না।",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardRequest(request, context, "GET");
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardRequest(request, context, "PUT");
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardRequest(request, context, "DELETE");
}
