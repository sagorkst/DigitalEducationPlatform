
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("shikhasetu_session")?.value;

  let backendRevoked = false;

  if (accessToken) {
    try {
      const apiResponse = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      backendRevoked = apiResponse.ok;
    } catch {
      backendRevoked = false;
    }
  }

  const response = NextResponse.json({
    success: true,
    message: "আপনি Logout করেছেন।",
    backendRevoked,
  });

  response.cookies.delete("shikhasetu_session");

  return response;
}
