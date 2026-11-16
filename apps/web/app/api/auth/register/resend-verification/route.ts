import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration token পাওয়া যায়নি।",
        },
        { status: 400 },
      );
    }

    const apiResponse = await fetch(
      `${API_BASE_URL}/auth/register/resend-verification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
        cache: "no-store",
      },
    );

    const result = await apiResponse.json();

    if (!apiResponse.ok || !result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message ?? "নতুন OTP পাঠানো যায়নি।",
        },
        { status: apiResponse.status || 400 },
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না।",
      },
      { status: 502 },
    );
  }
}
