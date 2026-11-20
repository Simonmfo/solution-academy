import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/layout/platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user || !profile) {
    redirect("/login");
  }

  return <PlatformShell profile={profile}>{children}</PlatformShell>;
}

