import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.toString();
    const response = await fetch(
      `${API_BASE_URL}/public/exams${query ? `?${query}` : ""}`,
      { cache: "no-store" },
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to load public exams." },
      { status: 503 },
    );
  }
}
