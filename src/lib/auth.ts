import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return request.cookies.get("app-access-token")?.value ?? null;
  }
  return authorization.slice("Bearer ".length).trim() || null;
}

export async function getAuthenticatedUserId(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return null;
  }

  const {
    data: { user },
    error
  } = await client.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user.id;
}

export function requiresSupabaseAuth() {
  return process.env.APP_STORAGE_PROVIDER === "supabase";
}
