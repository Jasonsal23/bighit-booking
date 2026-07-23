import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for use in API routes / server code only.
 * Bypasses RLS, so never import this into client components.
 *
 * Untyped on purpose: the generated `Database` type in ./types is a hand-written
 * approximation, not the real Supabase codegen output, so passing it as the
 * client generic makes every query result `never`. Callers cast to the
 * interfaces in ./types where needed.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
