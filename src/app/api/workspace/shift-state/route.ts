import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedShopContext } from "@/lib/auth/session";
import { hasRequiredRole } from "@/lib/auth/permissions";
import { dbQuery, dbQueryOne } from "@/lib/db/pool";
import { writeAuditLog } from "@/lib/audit/log";

export interface ShiftScheduleState {
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
  overrideShift: "MORNING" | "EVENING" | "NIGHT" | null;
  overrideDate: string | null;
  serverNowIso: string;
}

function todayPkDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const DEFAULT_SCHEDULE = {
  morningStart: "08:00",
  morningEnd: "16:00",
  eveningStart: "16:00",
  eveningEnd: "00:00",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  try {
    const ctx = await getAuthenticatedShopContext();
    if (!ctx || !ctx.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await dbQueryOne<{
      morning_start: string;
      morning_end: string;
      evening_start: string;
      evening_end: string;
      override_shift: string | null;
      override_date: string | Date | null;
    }>(
      `SELECT morning_start, morning_end, evening_start, evening_end,
              override_shift, override_date
       FROM public.shift_settings
       WHERE business_id = $1`,
      [ctx.businessId]
    );

    const todayPk = todayPkDate();
    const rowDate = row?.override_date
      ? row.override_date instanceof Date
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
            row.override_date
          )
        : String(row.override_date).slice(0, 10)
      : null;

    const validOverride =
      row?.override_shift && rowDate === todayPk
        ? (row.override_shift as "MORNING" | "EVENING" | "NIGHT")
        : null;

    const payload: ShiftScheduleState = {
      morningStart: row?.morning_start || DEFAULT_SCHEDULE.morningStart,
      morningEnd: row?.morning_end || DEFAULT_SCHEDULE.morningEnd,
      eveningStart: row?.evening_start || DEFAULT_SCHEDULE.eveningStart,
      eveningEnd: row?.evening_end || DEFAULT_SCHEDULE.eveningEnd,
      overrideShift: validOverride,
      overrideDate: validOverride ? rowDate : null,
      serverNowIso: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.error("[shift-state GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load shift settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthenticatedShopContext();
    if (!ctx || !ctx.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasRequiredRole(ctx.role, ["OWNER", "MANAGER"])) {
      return NextResponse.json(
        { error: "Only Owners or Managers can modify shift schedules or active shift overrides." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      overrideShift?: string | null;
      morningStart?: string;
      morningEnd?: string;
      eveningStart?: string;
      eveningEnd?: string;
    };

    const existing = await dbQueryOne<{
      morning_start: string;
      morning_end: string;
      evening_start: string;
      evening_end: string;
      override_shift: string | null;
      override_date: string | Date | null;
    }>(
      `SELECT morning_start, morning_end, evening_start, evening_end,
              override_shift, override_date
       FROM public.shift_settings WHERE business_id = $1`,
      [ctx.businessId]
    );

    const morningStart =
      body.morningStart && TIME_RE.test(body.morningStart)
        ? body.morningStart
        : existing?.morning_start || DEFAULT_SCHEDULE.morningStart;
    const morningEnd =
      body.morningEnd && TIME_RE.test(body.morningEnd)
        ? body.morningEnd
        : existing?.morning_end || DEFAULT_SCHEDULE.morningEnd;
    const eveningStart =
      body.eveningStart && TIME_RE.test(body.eveningStart)
        ? body.eveningStart
        : existing?.evening_start || DEFAULT_SCHEDULE.eveningStart;
    const eveningEnd =
      body.eveningEnd && TIME_RE.test(body.eveningEnd)
        ? body.eveningEnd
        : existing?.evening_end || DEFAULT_SCHEDULE.eveningEnd;

    let overrideShift: "MORNING" | "EVENING" | "NIGHT" | null = null;
    const todayPk = todayPkDate();
    if (body.overrideShift === undefined) {
      const prevDate = existing?.override_date ? String(existing.override_date).slice(0, 10) : null;
      if (existing?.override_shift && prevDate === todayPk) {
        overrideShift = existing.override_shift as "MORNING" | "EVENING" | "NIGHT";
      }
    } else if (
      body.overrideShift === "MORNING" ||
      body.overrideShift === "EVENING" ||
      body.overrideShift === "NIGHT"
    ) {
      overrideShift = body.overrideShift;
    }

    const overrideDate = overrideShift ? todayPk : null;

    await dbQuery(
      `INSERT INTO public.shift_settings (
         business_id, morning_start, morning_end, evening_start, evening_end,
         override_shift, override_date, updated_by, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (business_id) DO UPDATE SET
         morning_start = EXCLUDED.morning_start,
         morning_end = EXCLUDED.morning_end,
         evening_start = EXCLUDED.evening_start,
         evening_end = EXCLUDED.evening_end,
         override_shift = EXCLUDED.override_shift,
         override_date = EXCLUDED.override_date,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        ctx.businessId,
        morningStart,
        morningEnd,
        eveningStart,
        eveningEnd,
        overrideShift,
        overrideDate,
        ctx.userId,
      ]
    );

    await writeAuditLog({
      businessId: ctx.businessId,
      actorName: ctx.fullName,
      actionType: "SHIFT_SCHEDULE_UPDATED",
      description: `Shift config updated (${morningStart}-${morningEnd}, ${eveningStart}-${eveningEnd}; active override: ${overrideShift ?? "AUTO"})`,
      metadata: {
        morningStart,
        morningEnd,
        eveningStart,
        eveningEnd,
        overrideShift,
      },
    });

    const payload: ShiftScheduleState = {
      morningStart,
      morningEnd,
      eveningStart,
      eveningEnd,
      overrideShift,
      overrideDate,
      serverNowIso: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[shift-state POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save shift settings." },
      { status: 500 }
    );
  }
}
