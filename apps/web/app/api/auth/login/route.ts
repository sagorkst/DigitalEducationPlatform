
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

type LoginResponse = {
  success?: boolean;
  message?: string;
  data?: {
    accessToken?: string;
    user?: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      status: string;
    };
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const identifier =
      typeof body.identifier === "string" ? body.identifier.trim() : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "ইমেইল/মোবাইল নম্বর এবং পাসওয়ার্ড দিতে হবে।",
        },
        { status: 400 },
      );
    }

    const apiResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier, password }),
      cache: "no-store",
    });

    const result = (await apiResponse.json()) as LoginResponse;

    if (!apiResponse.ok || !result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message ?? "লগইন করা যায়নি। আবার চেষ্টা করুন।",
        },
        { status: apiResponse.status || 401 },
      );
    }

    const accessToken = result.data?.accessToken;
    const user = result.data?.user;

    if (!accessToken || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Backend থেকে সঠিক Login Response পাওয়া যায়নি।",
        },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      success: true,
      message: result.message ?? "Login successful.",
      data: { user },
    });

    response.cookies.set("shikhasetu_session", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message:
          "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। Backend চালু আছে কি না পরীক্ষা করুন।",
      },
      { status: 502 },
    );
  }
}
