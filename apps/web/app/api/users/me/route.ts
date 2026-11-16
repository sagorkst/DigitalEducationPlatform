import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("shikhasetu_session")?.value;
}

async function proxyProfile(request: NextRequest, method: "GET" | "PATCH") {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    let body: string | undefined;

    if (method === "PATCH") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(await request.json());
    }

    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const responseBody = await response.json().catch(() => ({
      success: false,
      message: "Unable to process the API response.",
    }));

    return NextResponse.json(responseBody, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to connect to the API server." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyProfile(request, "GET");
}

export async function PATCH(request: NextRequest) {
  return proxyProfile(request, "PATCH");
}
