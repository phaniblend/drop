"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  PROFINDER_COOKIE,
  canOpenProfinder,
  passwordsMatch,
  profinderCookieValue,
} from "@/lib/profinder-access";

export async function unlockProfinder(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email;
  if (!canOpenProfinder(email)) redirect("/profinder");

  if (!passwordsMatch(String(formData.get("password") || ""))) {
    redirect("/profinder?error=1");
  }

  const jar = await cookies();
  jar.set(PROFINDER_COOKIE, profinderCookieValue(email!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/profinder",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/profinder");
}
