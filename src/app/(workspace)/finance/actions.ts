"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { pkrToPaisa } from "@/lib/format/currency";

// 1. Create Financial Account / Wallet
export async function createFinancialAccountAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const accountName = (formData.get("accountName") as string)?.trim();
  const accountType = (formData.get("accountType") as string) || "CASH";
  const openingBalancePkr = (formData.get("openingBalance") as string) || "0";
  const description = (formData.get("description") as string)?.trim();

  if (!accountName) throw new Error("Account name is required.");

  const admin = createSupabaseAdminClient();
  const openingPaisa = pkrToPaisa(openingBalancePkr);

  const { error } = await admin.from("financial_accounts").insert({
    business_id: ctx.businessId,
    account_name: accountName,
    account_type: accountType,
    opening_balance_paisa: openingPaisa,
    description: description,
  });

  if (error) throw new Error(`Failed to create account: ${error.message}`);
  revalidatePath("/finance");
}

// 2. Record Owner Capital Contribution
export async function recordOwnerContributionAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const ownerName = (formData.get("ownerName") as string)?.trim();
  const contributionType = (formData.get("contributionType") as string) || "CASH";
  const amountPkr = (formData.get("amount") as string) || "0";
  const receivingAccountId = formData.get("receivingAccountId") as string;
  const notes = (formData.get("notes") as string)?.trim();

  if (!ownerName) throw new Error("Owner name is required.");
  const amountPaisa = pkrToPaisa(amountPkr);
  if (amountPaisa <= 0) throw new Error("Contribution amount must be greater than zero.");

  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("owner_contributions").insert({
    business_id: ctx.businessId,
    owner_name: ownerName,
    contribution_type: contributionType,
    amount_paisa: amountPaisa,
    receiving_account_id: receivingAccountId || null,
    notes: notes,
    recorded_by: (ctx as any).userId || null,
  });

  if (error) throw new Error(`Failed to record contribution: ${error.message}`);
  revalidatePath("/finance");
}

// 3. Record Household or Owner Drawing
export async function recordOwnerDrawingAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const ownerName = (formData.get("ownerName") as string)?.trim();
  const category = (formData.get("category") as string) || "HOUSEHOLD_EXPENSE";
  const amountPkr = (formData.get("amount") as string) || "0";
  const sourceAccountId = formData.get("sourceAccountId") as string;
  const purpose = (formData.get("purpose") as string)?.trim();

  if (!ownerName) throw new Error("Owner name is required.");
  const amountPaisa = pkrToPaisa(amountPkr);
  if (amountPaisa <= 0) throw new Error("Drawing amount must be greater than zero.");

  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("owner_drawings").insert({
    business_id: ctx.businessId,
    owner_name: ownerName,
    category: category,
    amount_paisa: amountPaisa,
    source_account_id: sourceAccountId || null,
    purpose: purpose,
    recorded_by: (ctx as any).userId || null,
  });

  if (error) throw new Error(`Failed to record drawing: ${error.message}`);
  revalidatePath("/finance");
}

// 4. Internal Account Transfer
export async function createAccountTransferAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");

  const sourceAccountId = formData.get("sourceAccountId") as string;
  const destinationAccountId = formData.get("destinationAccountId") as string;
  const amountPkr = (formData.get("amount") as string) || "0";
  const referenceNumber = (formData.get("referenceNumber") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();

  if (!sourceAccountId || !destinationAccountId) throw new Error("Source and destination accounts are required.");
  if (sourceAccountId === destinationAccountId) throw new Error("Cannot transfer to the same account.");

  const amountPaisa = pkrToPaisa(amountPkr);
  if (amountPaisa <= 0) throw new Error("Transfer amount must be greater than zero.");

  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("account_transfers").insert({
    business_id: ctx.businessId,
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    amount_paisa: amountPaisa,
    reference_number: referenceNumber,
    description: description,
    recorded_by: (ctx as any).userId || null,
  });

  if (error) throw new Error(`Failed to execute transfer: ${error.message}`);
  revalidatePath("/finance");
}