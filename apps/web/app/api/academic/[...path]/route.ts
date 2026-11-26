import { NextRequest, NextResponse } from "next/server";
const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:4000/api").replace(/\/+$/, "");
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
 const { path } = await context.params;
 if (!Array.isArray(path) || path.length < 1 || path.length > 2 || path[0] !== "classes" || path.some(part => !part || part === "." || part === ".." || part.includes("\\"))) return NextResponse.json({success:false,message:"Invalid academic path."},{status:400});
 try {
  const upstream = await fetch(API_BASE_URL + "/academic/" + path.map(encodeURIComponent).join("/") + request.nextUrl.search,{cache:"no-store",headers:{Accept:"application/json"}});
  return new NextResponse(await upstream.text(),{status:upstream.status,headers:{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
 } catch { return NextResponse.json({success:false,message:"Unable to connect to API server."},{status:502}); }
}
