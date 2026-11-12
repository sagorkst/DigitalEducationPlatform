
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("shikhasetu_session")?.value;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "প্রথমে লগইন করুন।" },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams.toString();

    const apiResponse = await fetch(
      `${API_BASE_URL}/questions${searchParams ? `?${searchParams}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    const result = await apiResponse.json();

    return NextResponse.json(result, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Questions API-তে সংযোগ করা যাচ্ছে না।" },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "প্রথমে লগইন করুন।" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const apiResponse = await fetch(`${API_BASE_URL}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const result = await apiResponse.json();

    return NextResponse.json(result, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Question তৈরি করা যায়নি।" },
      { status: 502 },
    );
  }
}
