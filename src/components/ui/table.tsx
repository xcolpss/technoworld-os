import * as React from "react";
import { twMerge } from "tailwind-merge";

export function Table({
  className = "",
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md shadow-[inset_0_1px_0_var(--glass-highlight)]">
      <table
        className={twMerge("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={twMerge(
        "border-b border-[var(--border)] bg-[var(--warm)] text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-secondary)]",
        className
      )}
      {...props}
    />
  );
}

export function TableBody({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={twMerge("divide-y divide-[var(--border)]", className)}
      {...props}
    />
  );
}

export function TableRow({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={twMerge(
        "transition-colors duration-150 hover:bg-[var(--warm)]",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({
  className = "",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={twMerge("px-4 py-3 font-semibold", className)}
      {...props}
    />
  );
}

export function TableCell({
  className = "",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={twMerge("px-4 py-3.5 text-[var(--foreground)]", className)}
      {...props}
    />
  );
}
