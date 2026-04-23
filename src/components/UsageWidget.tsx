"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { UsageInfo } from "@/lib/dam-api";

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function barColour(pct: number): string {
  if (pct >= 0.9) return "bg-red-500";
  if (pct >= 0.75) return "bg-amber-500";
  return "bg-green-500";
}

interface RowProps {
  label: string;
  used: number;
  limit: number | null;
  formatValue: (n: number) => string;
  unlimitedLabel: string;
}

function UsageRow({ label, used, limit, formatValue, unlimitedLabel }: RowProps) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : limit === 0 ? 1 : Math.min(1, used / limit);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-xs font-medium text-slate-600 shrink-0">{label}</span>
        <span className="text-xs text-slate-500 tabular-nums truncate text-right">
          {unlimited ? unlimitedLabel : `${formatValue(used)} / ${formatValue(limit!)}`}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
        {unlimited ? (
          <div className="h-full w-full bg-green-400 rounded-full" />
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColour(pct)}`}
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

interface Props {
  usage: UsageInfo;
}

export default function UsageWidget({ usage }: Props) {
  const t = useTranslations("usageWidget");
  const hasLimits = usage.storage_limit_bytes !== null || usage.asset_limit !== null;

  return (
    <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2.5">
      <UsageRow
        label={t("storage")}
        used={usage.used_bytes}
        limit={usage.storage_limit_bytes}
        formatValue={formatBytes}
        unlimitedLabel={t("unlimited")}
      />
      <UsageRow
        label={t("assets")}
        used={usage.asset_count}
        limit={usage.asset_limit}
        formatValue={(n) => n.toLocaleString()}
        unlimitedLabel={t("unlimited")}
      />
      {hasLimits && (
        <div className="pt-0.5">
          <Link
            href="/pricing"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            {t("upgrade")} →
          </Link>
        </div>
      )}
    </div>
  );
}
