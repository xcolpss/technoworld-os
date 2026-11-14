import * as React from "react";

export function Table({
  className = "",
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table
        className={`w-full border-collapse text-left text-sm ${className}`}
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
      className={`border-b border-border bg-warm text-xs font-semibold uppercase tracking-wider text-muted ${className}`}
      {...props}
    />
  );
}

export function TableBody({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-border ${className}`} {...props} />;
}

export function TableRow({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors hover:bg-warm/60 ${className}`}
      {...props}
    />
  );
}

export function TableHead({
  className = "",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 font-semibold ${className}`} {...props} />;
}

export function TableCell({
  className = "",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3.5 text-ink ${className}`} {...props} />;
}
