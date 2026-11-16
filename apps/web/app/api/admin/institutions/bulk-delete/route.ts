import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = (
  process.env.API_BASE_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

export async function DELETE() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("shikhasetu_session")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const apiResponse = await fetch(
      `${API_BASE_URL}/institutions/bulk-delete`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

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
