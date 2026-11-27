import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = (
  process.env.API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/+$/, "");

type ApiRecord = Record<string, unknown>;

type ApiListResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  pagination?: {
    totalPages?: number;
  };
};

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchAllRecords(
  resource: "institutions" | "exams" | "posts",
  token: string,
): Promise<ApiRecord[]> {
  const records: ApiRecord[] = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page++) {
    const query = new URLSearchParams({
      page: String(page),
      limit: "100",
    });

    const response = await fetch(
      `${API_BASE_URL}/${resource}?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const responseText = await response.text();

    let payload: ApiListResponse;

    try {
      payload = JSON.parse(responseText) as ApiListResponse;
    } catch {
      throw new Error(`${resource} API returned a non-JSON response.`);
    }

    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || `Unable to load ${resource}.`);
    }

    if (!Array.isArray(payload.data)) {
      throw new Error(`Invalid ${resource} API response.`);
    }

    records.push(...payload.data.filter(isRecord));

    const reportedPages = Number(payload.pagination?.totalPages ?? 1);

    totalPages = Number.isInteger(reportedPages)
      ? Math.max(1, Math.min(reportedPages, 1000))
      : 1;
  }

  return records;
}

function uniqueNames(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;

    const name = value.trim();
    const key = name.toLocaleLowerCase();

    if (!name || seen.has(key)) continue;

    seen.add(key);
    result.push(name);
  }

  return result;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shikhasetu_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      );
    }

    const [institutions, exams, posts] = await Promise.all([
      fetchAllRecords("institutions", token),
      fetchAllRecords("exams", token),
      fetchAllRecords("posts", token),
    ]);

    const years = Array.from(
      new Set(
        exams
          .map((exam) => Number(exam.examYear))
          .filter(
            (year) =>
              Number.isInteger(year) && year >= 1900 && year <= 2100,
          ),
      ),
    )
      .sort((a, b) => b - a)
      .map(String);

    return NextResponse.json({
      success: true,
      data: {
        institutions: uniqueNames(institutions.map((item) => item.name)),
        examNames: uniqueNames(exams.map((item) => item.name)),
        postNames: uniqueNames(posts.map((item) => item.name)),
        years,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "Unable to load Batch Metadata suggestions.",
      },
      { status: 502 },
    );
  }
}