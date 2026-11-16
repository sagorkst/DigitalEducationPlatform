import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const accountType =
      typeof body.accountType === "string" ? body.accountType : "";

    const allowedAccountTypes = [
      "GENERAL",
      "STUDENT",
      "JOB_SEEKER",
      "TEACHER",
      "INSTITUTION",
    ];

    if (
      !name ||
      !email ||
      !phone ||
      !password ||
      !allowedAccountTypes.includes(accountType)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "নাম, ইমেইল, মোবাইল নম্বর, অ্যাকাউন্টের ধরন ও পাসওয়ার্ড দিতে হবে।",
        },
        { status: 400 },
      );
    }

    const apiResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        accountType,
        password,
      }),
      cache: "no-store",
    });

    const result = await apiResponse.json();

    if (!apiResponse.ok || !result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message ?? "অ্যাকাউন্ট তৈরি করা যায়নি।",
        },
        { status: apiResponse.status || 400 },
      );
    }

    if (!result.data?.registrationToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Backend থেকে Registration Token পাওয়া যায়নি।",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result, { status: 201 });
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
