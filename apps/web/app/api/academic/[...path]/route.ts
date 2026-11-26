import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
const API_BASE_URL=(process.env.API_BASE_URL||"http://localhost:4000/api").replace(/\/+$/,"");
type Context={params:Promise<{path:string[]}>};
function allowed(path:string[],method:string){
 if(method==="GET") return (path.length===1&&path[0]==="classes")||(path.length===2&&path[0]==="classes")||(path.length===1&&["my-enrollment","my-progress","sessions"].includes(path[0]));
 if(method==="POST") return path.length===1&&path[0]==="enroll"||path.length===3&&path[0]==="lessons"&&path[2]==="progress";
 return false;
}
async function proxy(request:NextRequest,context:Context,method:"GET"|"POST"){
 const {path}=await context.params;
 if(!Array.isArray(path)||!allowed(path,method)||path.some(s=>!s||s==="."||s===".."||s.includes("\\"))) return NextResponse.json({success:false,message:"Invalid academic path."},{status:400});
 const privateRoute=path[0]==="my-enrollment"||path[0]==="my-progress"||path[0]==="sessions"||method==="POST";
 const store=await cookies();const token=store.get("shikhasetu_session")?.value;
 if(privateRoute&&!token)return NextResponse.json({success:false,message:"Authentication required."},{status:401});
 const headers:Record<string,string>={Accept:"application/json"};
 if(token)headers.Authorization="Bearer "+token;
 let body:string|undefined;
 if(method==="POST"){headers["Content-Type"]="application/json";body=await request.text()}
 try{
  const upstream=await fetch(API_BASE_URL+"/academic/"+path.map(encodeURIComponent).join("/")+(method==="GET"?request.nextUrl.search:""),{method,headers,body,cache:"no-store"});
  const response=new NextResponse(await upstream.text(),{status:upstream.status,headers:{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
  if(upstream.status===401)response.cookies.delete("shikhasetu_session");
  return response;
 }catch{return NextResponse.json({success:false,message:"Unable to connect to API server."},{status:502})}
}
export async function GET(request:NextRequest,context:Context){return proxy(request,context,"GET")}
export async function POST(request:NextRequest,context:Context){return proxy(request,context,"POST")}
