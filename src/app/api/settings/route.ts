import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { repositoryGetSettings, repositorySaveSettings } from "@/lib/repositories";
import { AppSettings } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  return NextResponse.json(await repositoryGetSettings(userId));
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const body = (await request.json()) as AppSettings;
  return NextResponse.json(await repositorySaveSettings(body, userId));
}
