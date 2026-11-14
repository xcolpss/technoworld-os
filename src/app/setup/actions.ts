"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function initializeBusinessAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const businessName =
    String(formData.get("businessName") || "TechnoWorld").trim() || "TechnoWorld";
  const ownerFullName =
    String(formData.get("ownerFullName") || "").trim() ||
    user.email?.split("@")[0] ||
    "Owner";
  const city = String(formData.get("city") || "Rawalpindi").trim() || "Rawalpindi";

  const admin = createSupabaseAdminClient();

  // 1. Upsert user profile
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    full_name: ownerFullName,
    email: user.email ?? null,
    status: "ACTIVE",
  });
  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  // Check if user already has an active membership
  const { data: existingMembership } = await admin
    .from("memberships")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existingMembership) {
    redirect("/dashboard");
  }

  // 2. Create Business
  const { data: business, error: bizError } = await admin
    .from("businesses")
    .insert({
      name: businessName,
      city,
      country: "Pakistan",
      default_currency: "PKR",
      timezone: "Asia/Karachi",
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (bizError || !business) {
    throw new Error(`Failed to create business: ${bizError?.message}`);
  }

  // 3. Create System Roles (OWNER, MANAGER, EMPLOYEE)
  const { data: createdRoles, error: rolesError } = await admin
    .from("roles")
    .insert([
      {
        business_id: business.id,
        code: "OWNER",
        name: "Owner",
        description: "Full administrative, operational, and confidential capital access",
        is_system: true,
      },
      {
        business_id: business.id,
        code: "MANAGER",
        name: "Manager",
        description: "Configurable operational, inventory, and shift supervision access",
        is_system: true,
      },
      {
        business_id: business.id,
        code: "EMPLOYEE",
        name: "Employee",
        description: "Counter POS, permitted refunds/discounts, expenses, and own shift access",
        is_system: true,
      },
    ])
    .select("id, code");

  if (rolesError || !createdRoles) {
    throw new Error(`Failed to create roles: ${rolesError?.message}`);
  }

  const ownerRole = createdRoles.find((r) => r.code === "OWNER");
  if (!ownerRole) {
    throw new Error("OWNER role creation failed.");
  }

  // 4. Create Owner Membership & Confidential Owner Capital Profile
  await admin.from("memberships").insert({
    business_id: business.id,
    profile_id: user.id,
    role_id: ownerRole.id,
    status: "ACTIVE",
  });

  await admin.from("owners").insert({
    business_id: business.id,
    profile_id: user.id,
    display_name: ownerFullName,
    equity_share_bps: 10000,
    status: "ACTIVE",
  });

  // 5. Create the 3 Shop Terminals (Computers)
  const { data: terminals } = await admin
    .from("terminals")
    .insert([
      {
        business_id: business.id,
        code: "PC-01",
        name: "Main Counter PC-01",
        location_label: "Front POS & 80mm Receipt Printer",
        has_receipt_printer: true,
        has_cash_drawer: true,
        status: "ACTIVE",
      },
      {
        business_id: business.id,
        code: "PC-02",
        name: "Service Desk PC-02",
        location_label: "Printing, Forms & Media Station",
        has_receipt_printer: false,
        has_cash_drawer: false,
        status: "ACTIVE",
      },
      {
        business_id: business.id,
        code: "PC-03",
        name: "Editing & Repair PC-03",
        location_label: "Photo/Video Editing & Tech Bench",
        has_receipt_printer: false,
        has_cash_drawer: false,
        status: "ACTIVE",
      },
    ])
    .select("id, code");

  // 6. Initialize Default Settings
  await admin.from("business_settings").insert({
    business_id: business.id,
    morning_shift_start: "08:00:00",
    morning_shift_end: "16:00:00",
    evening_shift_start: "16:00:00",
    evening_shift_end: "00:00:00",
    require_shift_open_for_sales: true,
    allow_negative_stock: false,
    tax_enabled: false,
    default_tax_bps: 0,
  });

  await admin.from("receipt_settings").insert({
    business_id: business.id,
    header_title: businessName,
    header_subtitle: "Retail & Computer Services",
    address_line: city,
    footer_message: "Thank you for visiting TechnoWorld!",
    show_cashier_name: true,
    show_terminal_code: true,
  });

  const mainTerminal = terminals?.find((t) => t.code === "PC-01");
  if (mainTerminal) {
    await admin.from("printer_settings").insert({
      business_id: business.id,
      terminal_id: mainTerminal.id,
      paper_width_mm: 80,
      connection_type: "USB",
      auto_cut_paper: true,
      kick_cash_drawer_on_cash_sale: true,
    });
  }

  await admin.from("notification_settings").insert({
    business_id: business.id,
    notify_low_stock: true,
    notify_cash_discrepancy: true,
    notify_large_refund: true,
    large_refund_threshold_paisa: 500000,
  });

  // 7. Record Immutable Audit Log Entry
  await admin.from("audit_logs").insert({
    business_id: business.id,
    actor_profile_id: user.id,
    action: "BUSINESS_INITIALIZED",
    entity_type: "businesses",
    entity_id: business.id,
    after_state: {
      name: businessName,
      city,
      currency: "PKR",
      timezone: "Asia/Karachi",
    },
  });

  redirect("/dashboard");
}
