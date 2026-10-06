"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle(formData?: FormData) {
  const next = String(formData?.get("next") || "/");
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  await signIn("google", { redirectTo: safe });
}

export async function signOutOperator() {
  await signOut({ redirectTo: "/login" });
}

export async function signOutToProfinderLogin() {
  await signOut({ redirectTo: "/login?next=/profinder" });
}
