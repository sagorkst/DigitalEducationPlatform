import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("shikhasetu_session")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "প্রথমে লগইন করুন।" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const apiResponse = await fetch(`${API_BASE_URL}/questions/bulk/permanent-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const responseBody = await apiResponse.text();

    return new NextResponse(responseBody, {
      status: apiResponse.status,
      headers: {
        "Content-Type":
          apiResponse.headers.get("content-type") ??
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Permanent Delete API-তে সংযোগ করা যাচ্ছে না।" },
      { status: 502 },
    );
  }
}
