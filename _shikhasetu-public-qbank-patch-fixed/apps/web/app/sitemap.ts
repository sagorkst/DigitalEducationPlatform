import type { MetadataRoute } from "next";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return [];
  const base = site.replace(/\/+$/, "");
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/question-bank`, changeFrequency: "daily", priority: 0.9 },
  ];
  try {
    const [subjectsResponse, filtersResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/public/subjects`, { next: { revalidate: 3600 } }),
      fetch(`${API_BASE_URL}/public/filters`, { next: { revalidate: 3600 } }),
    ]);
    if (subjectsResponse.ok) {
      const subjectsResult = await subjectsResponse.json();
      for (const subject of subjectsResult.data ?? []) {
        entries.push({ url: `${base}/question-bank/subject/${subject.id}`, changeFrequency: "weekly", priority: 0.75 });
      }
    }
    if (filtersResponse.ok) {
      const filtersResult = await filtersResponse.json();
      for (const topic of filtersResult.data?.topics ?? []) {
        entries.push({ url: `${base}/question-bank/topic/${topic.id}`, changeFrequency: "weekly", priority: 0.65 });
      }
    }
    const first = await fetch(`${API_BASE_URL}/public/questions?page=1&limit=100`, { next: { revalidate: 3600 } });
    if (!first.ok) return entries;
    const result = await first.json();
    const totalPages = Math.min(Number(result.pagination?.totalPages ?? 1), 100);
    const ids: string[] = (result.data ?? []).map((q: { id: string }) => q.id);
    for (let page = 2; page <= totalPages; page++) {
      const response = await fetch(`${API_BASE_URL}/public/questions?page=${page}&limit=100`, { next: { revalidate: 3600 } });
      if (!response.ok) continue;
      const data = await response.json();
      ids.push(...(data.data ?? []).map((q: { id: string }) => q.id));
    }
    for (const id of ids) entries.push({ url: `${base}/question-bank/${id}`, changeFrequency: "monthly", priority: 0.7 });
  } catch {
    return entries;
  }
  return entries;
}
