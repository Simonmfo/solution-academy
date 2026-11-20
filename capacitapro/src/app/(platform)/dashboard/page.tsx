import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { getDefaultRouteForRole } from "@/lib/utils";

export default async function DashboardDispatcherPage() {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) {
    redirect("/login");
  }
  if (!profile) {
    return null;
  }
  redirect(getDefaultRouteForRole(profile.role));
}
