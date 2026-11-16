import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("shikhasetu_session")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Please select an HTML file." },
        { status: 400 },
      );
    }

    if (!/\.(html?|xhtml|mhtml|mht)$/i.test(file.name)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only HTML, HTM or XHTML files are supported.",
        },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          message: "HTML file must be between 1 byte and 5 MB.",
        },
        { status: 400 },
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const response = await fetch(
      `${API_BASE_URL}/imports/html/preview`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: backendFormData,
        cache: "no-store",
      },
    );

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to connect to the HTML import service.",
      },
      { status: 502 },
    );
  }
}
