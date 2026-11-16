import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = (
  process.env.API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/+$/, "");

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyAdminRequest(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("shikhasetu_session")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 },
      );
    }

    const { path } = await context.params;

    if (
      !Array.isArray(path) ||
      path.length === 0 ||
      path.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.includes("\\"),
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid API path.",
        },
        { status: 400 },
      );
    }

    const backendPath = path.map((segment) => encodeURIComponent(segment)).join("/");
    const targetUrl = `${API_BASE_URL}/${backendPath}${request.nextUrl.search}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    const method = request.method.toUpperCase();
    let body: string | undefined;

    if (method !== "GET" && method !== "HEAD") {
      body = await request.text();

      const contentType = request.headers.get("content-type");
      if (contentType) {
        headers["Content-Type"] = contentType;
      }
    }

    const apiResponse = await fetch(targetUrl, {
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
          apiResponse.headers.get("content-type") ??
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

    if (apiResponse.status === 401) {
      response.cookies.delete("shikhasetu_session");
    }

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to connect to the API server.",
      },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyAdminRequest(request, context);
}
