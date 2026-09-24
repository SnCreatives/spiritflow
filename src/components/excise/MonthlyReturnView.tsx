import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Printer,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building,
  FileText,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet } from '../../utils/api';
import { translations } from '../../utils/i18n';

interface MonthlyReturnViewProps {
  language: SupportedLanguage;
}

export const MonthlyReturnView: React.FC<MonthlyReturnViewProps> = ({ language }) => {
  const t = translations[language];

  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchMonthlyReturn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet(`/api/excise/monthly-return?month=${month}&year=${year}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to generate Monthly Foreign Liquor Return');
      }
      setReportData(res.data);
    } catch (err: any) {
      setError(err.message || 'Error generating Monthly Foreign Liquor Return');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchMonthlyReturn();
  }, [fetchMonthlyReturn]);

  const exportCSV = () => {
    if (!reportData || !reportData.transactions || reportData.transactions.length === 0) return;
    const headers = ['Date', 'Transaction Type', 'Reference #', 'Product Name', 'Brand', 'Category', 'Pack Size', 'Compliance Ref', 'Qty In', 'Qty Out', 'Balance'];
    const rows = reportData.transactions.map((tx: any) => [
      tx.date?.split('T')[0],
      tx.transactionType,
      tx.referenceNumber,
      tx.productName,
      tx.brandName,
      tx.categoryName,
      tx.packSize,
      tx.complianceRef,
      tx.quantityIn,
      tx.quantityOut,
      tx.balance,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.map(cell => `"${cell || ''}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Monthly_Foreign_Liquor_Return_${year}_${String(month).padStart(2, '0')}.csv`;
    a.click();
  };

  const copyTable = () => {
    if (!reportData || !reportData.transactions) return;
    const text = reportData.transactions
      .map((tx: any) => `${tx.date?.split('T')[0]}\t${tx.transactionType}\t${tx.referenceNumber}\t${tx.productName}\t${tx.quantityIn}\t${tx.quantityOut}\t${tx.balance}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setFeedback('Monthly return table copied to clipboard!');
    setTimeout(() => setFeedback(null), 3000);
  };

  const monthsList = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>Monthly Return of Transactions of Foreign Liquor</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Statutory return effected by holder of Vendor&apos;s / Hotel / Club Licence (Maharashtra State Excise norms).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchMonthlyReturn}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {reportData?.transactions?.length > 0 && (
            <>
              <button
                type="button"
                onClick={copyTable}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy</span>
              </button>
              <button
                type="button"
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV / Excel</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Month & Year Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Reporting Month</label>
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
          >
            {monthsList.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Reporting Year</label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value, 10) || 2026)}
            className="w-28 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {reportData && (
        <div className="space-y-6">
          {/* Statutory Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-4 text-center">
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                {reportData.reportTitle}
              </h3>
              <p className="text-xs text-amber-400 mt-1 font-medium">
                Period: {monthsList.find(m => m.value === month)?.label} {year} ({reportData.reportingPeriod?.startDate?.split(' ')[0]} to {reportData.reportingPeriod?.endDate?.split(' ')[0]})
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Licence Holder / Business</span>
                <span className="font-bold text-white">{reportData.licenceHolder?.businessName}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Licence Number / Ref</span>
                <span className="font-bold text-amber-400 font-mono">{reportData.licenceHolder?.licenceNumber}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Licence Type</span>
                <span className="font-bold text-white">{reportData.licenceHolder?.licenceType}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">VAT / Tax ID</span>
                <span className="font-bold text-emerald-400 font-mono">{reportData.licenceHolder?.vatNumber}</span>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="table-container">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Transaction Type</th>
                    <th className="py-3 px-3">Reference #</th>
                    <th className="py-3 px-3">Product Name & Brand</th>
                    <th className="py-3 px-3">Category / Pack Size</th>
                    <th className="py-3 px-3">Compliance Ref</th>
                    <th className="py-3 px-2 text-center text-amber-400">Qty In</th>
                    <th className="py-3 px-2 text-center text-rose-400">Qty Out</th>
                    <th className="py-3 px-3 text-center text-emerald-400">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                  {!reportData.transactions || reportData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="font-medium text-slate-300">No qualifying Foreign Liquor transactions recorded for {monthsList.find(m => m.value === month)?.label} {year}.</p>
                      </td>
                    </tr>
                  ) : (
                    reportData.transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">{tx.date?.split('T')[0]}</td>
                        <td className="py-3 px-3 font-sans font-semibold text-white">{tx.transactionType}</td>
                        <td className="py-3 px-3 text-amber-400">{tx.referenceNumber}</td>
                        <td className="py-3 px-3 font-sans">
                          <div className="font-semibold text-white">{tx.productName}</div>
                          <div className="text-[11px] text-slate-400">{tx.brandName}</div>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <div>{tx.categoryName}</div>
                          <div className="text-[11px] text-slate-400">{tx.packSize}</div>
                        </td>
                        <td className="py-3 px-3">{tx.complianceRef}</td>
                        <td className="py-3 px-2 text-center font-bold text-amber-400">{tx.quantityIn > 0 ? tx.quantityIn : '—'}</td>
                        <td className="py-3 px-2 text-center font-bold text-rose-400">{tx.quantityOut > 0 ? tx.quantityOut : '—'}</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-400">{tx.balance}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
