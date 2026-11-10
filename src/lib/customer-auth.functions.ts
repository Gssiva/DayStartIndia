import { createServerFn } from "@tanstack/react-start";

export type RegisterCustomerInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export type RegistrationCheck =
  | { ok: false; error: string }
  | {
      ok: true;
      name: string;
      email: string;
      phone: string;
      password: string;
    };

export function validateRegistration(data: RegisterCustomerInput): RegistrationCheck {
  const name = (data.name ?? "").trim().replace(/\s+/g, " ");
  const email = (data.email ?? "").trim().toLowerCase();
  const digits = (data.phone ?? "").replace(/\D/g, "");
  const normalizedDigits = digits.replace(/^0+/, "");

  const phone =
    normalizedDigits.startsWith("91") && normalizedDigits.length === 12
      ? normalizedDigits.slice(2)
      : normalizedDigits;

  const password = data.password ?? "";

  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Enter your full name." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (!/^[6-9]\d{9}$/.test(phone) || /^(\d)\1{9}$/.test(phone)) {
    return {
      ok: false,
      error: "Enter a valid 10-digit mobile number starting with 6-9.",
    };
  }

  if (password.length < 8 || password.length > 72) {
    return {
      ok: false,
      error: "Password must be between 8 and 72 characters.",
    };
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return {
      ok: false,
      error: "Password must contain at least one letter and one number.",
    };
  }

  if (password !== data.confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }

  return { ok: true, name, email, phone, password };
}

export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((data: RegisterCustomerInput) => data)
  .handler(async ({ data }) => {
    const validation = validateRegistration(data);

    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const { adminClient, assertServerReady, describeDbError } =
      await import("./supabase-admin.server");

    assertServerReady();

    const admin = adminClient();
    const { name, email, phone, password } = validation;

    // Check whether this mobile number already has a profile.
    const { data: existingProfile, error: lookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (lookupError) {
      throw describeDbError(lookupError, "Could not check your mobile number.");
    }

    if (existingProfile) {
      throw new Error("This mobile number is already registered. Please log in.");
    }

    // Create the authentication user.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        name,
        phone,
        role: "customer",
      },
    });

    if (createError || !created.user) {
      const code = createError?.code ?? "";
      const message = createError?.message ?? "";

      console.error("[register] createUser failed:", { code, message });

      if (code === "23505" || /already registered|already exists|user already/i.test(message)) {
        throw new Error("This email may already be registered. Please log in.");
      }

      throw describeDbError(createError, "Supabase could not create your account.");
    }

    const userId = created.user.id;

    // Save the customer's profile.
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: name,
        phone,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("[register] Profile save failed:", {
        code: profileError.code,
        message: profileError.message,
      });

      // Remove the newly created auth user if profile saving fails.
      const { error: rollbackError } = await admin.auth.admin.deleteUser(userId);

      if (rollbackError) {
        console.error("[register] User rollback failed:", {
          code: rollbackError.code,
          message: rollbackError.message,
        });
      }

      throw describeDbError(profileError, "Could not save your customer profile.");
    }

    console.info("[register] Customer registered successfully:", userId);

    return { ok: true as const };
  });
