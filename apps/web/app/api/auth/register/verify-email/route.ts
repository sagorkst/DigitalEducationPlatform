import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const token = typeof body.token === "string" ? body.token : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!token || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration token এবং সঠিক ৬ সংখ্যার OTP দিতে হবে।",
        },
        { status: 400 },
      );
    }

    const apiResponse = await fetch(
      `${API_BASE_URL}/auth/register/verify-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, code }),
        cache: "no-store",
      },
    );

    const result = await apiResponse.json();

    if (!apiResponse.ok || !result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message ?? "ইমেইল যাচাই করা যায়নি।",
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
