
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("shikhasetu_session")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: "আপনাকে প্রথমে লগইন করতে হবে।",
        },
        { status: 401 },
      );
    }

    const apiResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const result = await apiResponse.json().catch(() => ({
      success: false,
      message: "Backend থেকে সঠিক response পাওয়া যায়নি।",
    }));

    const response = NextResponse.json(result, {
      status: apiResponse.status,
    });

    if (apiResponse.status === 401 || apiResponse.status === 403) {
      response.cookies.delete("shikhasetu_session");
    }

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Session যাচাই করতে Backend-এর সঙ্গে সংযোগ করা যাচ্ছে না।",
      },
      { status: 502 },
    );
  }
}
