import { NextResponse } from "next/server";
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";
export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/public/filters`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, message: "ফিল্টার লোড করা যাচ্ছে না।" }, { status: 502 });
  }
}
