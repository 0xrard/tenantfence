import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  });
}
