import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = (
  process.env.API_BASE_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function proxyInstitutionRequest(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "PUT" | "DELETE",
) {
  const { id } = await context.params;

  if (!id || id === "." || id === ".." || id.includes("/") || id.includes("\\")) {
    return NextResponse.json(
      { message: "Invalid institution ID." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("shikhasetu_session")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const url = `${API_BASE_URL}/institutions/${encodeURIComponent(id)}${request.nextUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  let body: string | undefined;

  if (method === "PUT") {
    headers["Content-Type"] = "application/json";
    body = await request.text();
  }

  try {
    const apiResponse = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    if (apiResponse.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const responseBody = await apiResponse.text();
    const response = new NextResponse(responseBody, {
      status: apiResponse.status,
      headers: {
        "Content-Type":
          apiResponse.headers.get("content-type") || "application/json",
      },
    });

    if (apiResponse.status === 401) {
      response.cookies.delete("shikhasetu_session");
    }

    return response;
  } catch {
    return NextResponse.json(
      { message: "Unable to connect to the API server." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyInstitutionRequest(request, context, "GET");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyInstitutionRequest(request, context, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyInstitutionRequest(request, context, "DELETE");
}
