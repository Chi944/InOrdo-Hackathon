"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getSafeRedirect } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(512),
  next: z.string().max(2048).optional(),
});

type LoginActionState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  let signInFailed = false;

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    signInFailed = Boolean(error);
  } catch {
    return { error: "Sign-in is temporarily unavailable." };
  }

  if (signInFailed) {
    return { error: "Invalid email or password." };
  }

  redirect(getSafeRedirect(parsed.data.next));
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Sign-out could not be completed.");
  }

  redirect("/login");
}
