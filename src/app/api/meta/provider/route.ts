import { NextResponse } from "next/server";
import { getProviderConfig } from "@/lib/providers";

export async function GET() {
  return NextResponse.json(getProviderConfig());
}
