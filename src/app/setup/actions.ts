"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  PERSISTENCE_COOKIE_NAME,
} from "@/lib/auth/cookie-persistence";
import { revokeLocalAuthSession } from "@/lib/auth/local-auth";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/pool";

export async function signOutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  await revokeLocalAuthSession(token);
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(PERSISTENCE_COOKIE_NAME);
  redirect("/login?reason=signed_out");
}

export async function initializeBusinessAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx) {
    redirect("/login");
  }

  const businessName =
    String(formData.get("businessName") || "TechnoWorld").trim() ||
    "TechnoWorld";
  const ownerFullName =
    String(formData.get("ownerFullName") || "").trim() ||
    ctx.fullName ||
    ctx.email.split("@")[0] ||
    "Owner";
  const city =
    String(formData.get("city") || "Rawalpindi").trim() || "Rawalpindi";

  const alreadyRedirect = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO public.profiles (id, full_name, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
      [ctx.userId, ownerFullName, ctx.email || null]
    );

    const existingMembership = await client.query<{ id: string }>(
      `SELECT id FROM public.memberships WHERE profile_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [ctx.userId]
    );
    if ((existingMembership.rowCount ?? 0) > 0) {
      return true;
    }

    const bizRes = await client.query<{ id: string }>(
      `INSERT INTO public.businesses (name, city, country, default_currency, timezone, status)
       VALUES ($1, $2, 'Pakistan', 'PKR', 'Asia/Karachi', 'ACTIVE')
       RETURNING id`,
      [businessName, city]
    );
    const businessId = bizRes.rows[0].id;

    const rolesRes = await client.query<{ id: string; code: string }>(
      `INSERT INTO public.roles (business_id, code, name, description, is_system)
       VALUES
         ($1, 'OWNER', 'Owner', 'Full administrative, operational, and confidential capital access', true),
         ($1, 'MANAGER', 'Manager', 'Configurable operational, inventory, and shift supervision access', true),
         ($1, 'EMPLOYEE', 'Employee', 'Counter POS, permitted refunds/discounts, expenses, and own shift access', true)
       RETURNING id, code`,
      [businessId]
    );

    const ownerRole = rolesRes.rows.find((r) => r.code === "OWNER");
    if (!ownerRole) {
      throw new Error("OWNER role creation failed.");
    }

    await client.query(
      `INSERT INTO public.memberships (business_id, profile_id, role_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [businessId, ctx.userId, ownerRole.id]
    );

    await client.query(
      `INSERT INTO public.owners (business_id, profile_id, display_name, equity_share_bps, status)
       VALUES ($1, $2, $3, 10000, 'ACTIVE')`,
      [businessId, ctx.userId, ownerFullName]
    );

    const termRes = await client.query<{ id: string; code: string }>(
      `INSERT INTO public.terminals (business_id, code, name, location_label, has_receipt_printer, has_cash_drawer, status)
       VALUES
         ($1, 'PC-01', 'Main Counter PC-01', 'Front POS & 80mm Receipt Printer', true, true, 'ACTIVE'),
         ($1, 'PC-02', 'Service Desk PC-02', 'Printing, Forms & Media Station', false, false, 'ACTIVE'),
         ($1, 'PC-03', 'Editing & Repair PC-03', 'Photo/Video Editing & Tech Bench', false, false, 'ACTIVE')
       RETURNING id, code`,
      [businessId]
    );

    await client.query(
      `INSERT INTO public.business_settings (business_id, morning_shift_start, morning_shift_end, evening_shift_start, evening_shift_end, require_shift_open_for_sales, allow_negative_stock, tax_enabled, default_tax_bps)
       VALUES ($1, '08:00:00', '16:00:00', '16:00:00', '00:00:00', true, false, false, 0)`,
      [businessId]
    );

    await client.query(
      `INSERT INTO public.receipt_settings (business_id, header_title, header_subtitle, address_line, footer_message, show_cashier_name, show_terminal_code)
       VALUES ($1, $2, 'Retail & Computer Services', $3, 'Thank you for visiting TechnoWorld!', true, true)`,
      [businessId, businessName, city]
    );

    const mainTerminal = termRes.rows.find((t) => t.code === "PC-01");
    if (mainTerminal) {
      await client.query(
        `INSERT INTO public.printer_settings (business_id, terminal_id, paper_width_mm, connection_type, auto_cut_paper, kick_cash_drawer_on_cash_sale)
         VALUES ($1, $2, 80, 'USB', true, true)`,
        [businessId, mainTerminal.id]
      );
    }

    await client.query(
      `INSERT INTO public.notification_settings (business_id, notify_low_stock, notify_cash_discrepancy, notify_large_refund, large_refund_threshold_paisa)
       VALUES ($1, true, true, true, 500000)`,
      [businessId]
    );

    await client.query(
      `INSERT INTO public.audit_logs (business_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, 'BUSINESS_INITIALIZED', $3, $4::jsonb)`,
      [
        businessId,
        ownerFullName,
        `Initialized business ${businessName}`,
        JSON.stringify({ name: businessName, city, currency: "PKR", timezone: "Asia/Karachi" }),
      ]
    );

    return false;
  });

  if (alreadyRedirect) {
    redirect("/dashboard");
  }
  redirect("/dashboard");
}
