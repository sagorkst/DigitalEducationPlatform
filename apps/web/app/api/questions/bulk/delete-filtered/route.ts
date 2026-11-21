import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function forward(request: NextRequest, endpoint: string) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("shikhasetu_session")?.value;
    if (!accessToken) {
      return NextResponse.json({ success: false, message: "প্রথমে লগইন করুন।" }, { status: 401 });
    }
    const body = await request.json();
    const apiResponse = await fetch(`${API_BASE_URL}/questions/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await apiResponse.json();
    return NextResponse.json(result, { status: apiResponse.status });
  } catch {
    return NextResponse.json({ success: false, message: "Bulk Questions API-তে সংযোগ করা যাচ্ছে না।" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  return forward(request, "bulk/delete-filtered");
}
