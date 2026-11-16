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
        { success: false, message: "প্রথমে লগইন করুন।" },
        { status: 401 },
      );
    }

    const apiResponse = await fetch(`${API_BASE_URL}/questions/group-options`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const result = await apiResponse.json();

    return NextResponse.json(result, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Exam group লোড করা যায়নি।" },
      { status: 502 },
    );
  }
}