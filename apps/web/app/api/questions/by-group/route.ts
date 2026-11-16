import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("shikhasetu_session")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "প্রথমে লগইন করুন।" },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams.toString();

    const apiResponse = await fetch(
      `${API_BASE_URL}/questions/by-group${searchParams ? `?${searchParams}` : ""}`,
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
      { success: false, message: "এই Exam-এর প্রশ্ন লোড করা যায়নি।" },
      { status: 502 },
    );
  }
}