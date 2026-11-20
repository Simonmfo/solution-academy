import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { getDefaultRouteForRole } from "@/lib/utils";

export default async function DashboardDispatcherPage() {
  const { profile } = await getCurrentUserWithProfile();
  if (!profile) {
    redirect("/login");
  }
  redirect(getDefaultRouteForRole(profile.role));
}

