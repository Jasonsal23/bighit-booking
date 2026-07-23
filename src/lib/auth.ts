import { getServiceClient } from "@/lib/supabase/server";
import type { Barber } from "@/lib/supabase/types";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the bearer token from an admin API request and resolves it to the
 * barbers row it belongs to. Every admin route requires a signed-in barber;
 * "owner" role additionally sees/manages the whole shop, not just themselves.
 */
export async function getAuthedBarber(request: Request): Promise<Barber> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new AuthError("Missing bearer token");

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new AuthError("Invalid or expired session");

  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("*")
    .eq("auth_user_id", userData.user.id)
    .eq("active", true)
    .single<Barber>();
  if (barberError || !barber) throw new AuthError("No active barber account for this login", 403);

  return barber;
}
