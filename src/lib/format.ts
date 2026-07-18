export const formatINR = (n: number, opts?: { compact?: boolean; sign?: boolean }) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : opts?.sign && n > 0 ? "+" : "";
  if (opts?.compact) {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  }
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const todayISO = () => new Date().toISOString().slice(0, 10);
