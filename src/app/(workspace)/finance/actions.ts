"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { assertAuthorizedRole } from "@/lib/auth/permissions";
import { pkrToPaisa } from "@/lib/format/currency";
import { dbQuery } from "@/lib/db/pool";

export async function createFinancialAccountAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER"], "manage shop finances");

  const accountName = (formData.get("accountName") as string)?.trim();
  const accountType = (formData.get("accountType") as string) || "CASH";
  const openingBalancePkr = (formData.get("openingBalance") as string) || "0";
  const description = (formData.get("description") as string)?.trim() || null;

  if (!accountName) throw new Error("Account name is required.");

  const openingPaisa = pkrToPaisa(openingBalancePkr);

  await dbQuery(
    `INSERT INTO public.financial_accounts (business_id, account_name, account_type, opening_balance_paisa, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [ctx.businessId, accountName, accountType, openingPaisa, description]
  );

  revalidatePath("/finance");
}

export async function recordOwnerContributionAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER"], "manage shop finances");

  const ownerName = (formData.get("ownerName") as string)?.trim();
  const contributionType = (formData.get("contributionType") as string) || "CASH";
  const amountPkr = (formData.get("amount") as string) || "0";
  const receivingAccountId = (formData.get("receivingAccountId") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!ownerName) throw new Error("Owner name is required.");
  const amountPaisa = pkrToPaisa(amountPkr);
  if (amountPaisa <= 0) throw new Error("Contribution amount must be greater than zero.");

  await dbQuery(
    `INSERT INTO public.owner_contributions (business_id, owner_name, contribution_type, amount_paisa, receiving_account_id, notes, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [ctx.businessId, ownerName, contributionType, amountPaisa, receivingAccountId, notes, ctx.userId]
  );

  revalidatePath("/finance");
}

export async function recordOwnerDrawingAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER"], "manage shop finances");

  const ownerName = (formData.get("ownerName") as string)?.trim();
  const category = (formData.get("category") as string) || "HOUSEHOLD_EXPENSE";
  const amountPkr = (formData.get("amount") as string) || "0";
  const sourceAccountId = (formData.get("sourceAccountId") as string) || null;
  const purpose = (formData.get("purpose") as string)?.trim() || null;

  if (!ownerName) throw new Error("Owner name is required.");
  const amountPaisa = pkrToPaisa(amountPkr);
  if (amountPaisa <= 0) throw new Error("Drawing amount must be greater than zero.");

  await dbQuery(
    `INSERT INTO public.owner_drawings (business_id, owner_name, category, amount_paisa, source_account_id, purpose, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [ctx.businessId, ownerName, category, amountPaisa, sourceAccountId, purpose, ctx.userId]
  );

  revalidatePath("/finance");
}

export async function createAccountTransferAction(formData: FormData) {
  const ctx = await getAuthenticatedShopContext();
  if (!ctx || !ctx.businessId) redirect("/login");
  assertAuthorizedRole(ctx.role, ["OWNER"], "manage shop finances");

  const sourceAccountId = formData.get("sourceAccountId") as string;
  const destinationAccountId = formData.get("destinationAccountId") as string;
  const amountPkr = (formData.get("amount") as string) || "0";
  const referenceNumber = (formData.get("referenceNumber") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;

  if (!sourceAccountId || !destinationAccountId) {
    throw new Error("Source and destination accounts are required.");
  }
  if (sourceAccountId === destinationAccountId) {
    throw new Error("Cannot transfer to the same account.");
  }

  const amountPaisa = pkrToPaisa(amountPkr);
  if (amountPaisa <= 0) throw new Error("Transfer amount must be greater than zero.");

  await dbQuery(
    `INSERT INTO public.account_transfers (business_id, source_account_id, destination_account_id, amount_paisa, reference_number, description, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [ctx.businessId, sourceAccountId, destinationAccountId, amountPaisa, referenceNumber, description, ctx.userId]
  );

  revalidatePath("/finance");
}
