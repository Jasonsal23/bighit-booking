import { getServiceClient } from "@/lib/supabase/server";
import type { Barber, Customer } from "@/lib/supabase/types";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

async function getAuthedUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new AuthError("Missing bearer token");

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new AuthError("Invalid or expired session");

  return { supabase, userId: userData.user.id, email: userData.user.email ?? null };
}

/**
 * Verifies the bearer token from an admin API request and resolves it to the
 * barbers row it belongs to. Every admin route requires a signed-in barber;
 * "owner" role additionally sees/manages the whole shop, not just themselves.
 */
export async function getAuthedBarber(request: Request): Promise<Barber> {
  const { supabase, userId } = await getAuthedUser(request);

  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("*")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .single<Barber>();
  if (barberError || !barber) throw new AuthError("No active barber account for this login", 403);

  return barber;
}

/**
 * Verifies the bearer token from a customer API request and resolves it to
 * the customers row it belongs to (created via /api/customer/signup-complete
 * right after Supabase Auth sign-up).
 */
export async function getAuthedCustomer(request: Request): Promise<Customer> {
  const { supabase, userId } = await getAuthedUser(request);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", userId)
    .single<Customer>();
  if (customerError || !customer) throw new AuthError("No customer account for this login", 403);

  return customer;
}

export { getAuthedUser };
