import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("shikhasetu_session")?.value;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const incomingForm = await request.formData();
    const file = incomingForm.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, message: "Please select an image file." },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Image must not exceed 5 MB." },
        { status: 400 },
      );
    }

    const outgoingForm = new FormData();
    outgoingForm.set("file", file, file.name);

    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: outgoingForm,
      cache: "no-store",
    });

    const responseBody = await response.json().catch(() => ({
      success: false,
      message: "Unable to process the API response.",
    }));

    return NextResponse.json(responseBody, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to upload the profile photo." },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const responseBody = await response.json().catch(() => ({
      success: false,
      message: "Unable to process the API response.",
    }));

    return NextResponse.json(responseBody, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to remove the profile photo." },
      { status: 502 },
    );
  }
}
