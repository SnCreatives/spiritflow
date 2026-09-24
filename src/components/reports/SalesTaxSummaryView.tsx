import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  RefreshCw,
  Printer,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet } from '../../utils/api';
import { translations } from '../../utils/i18n';

interface SalesTaxSummaryViewProps {
  language: SupportedLanguage;
}

export const SalesTaxSummaryView: React.FC<SalesTaxSummaryViewProps> = ({ language }) => {
  const t = translations[language];

  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [hasTransactions, setHasTransactions] = useState(false);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState({ totalTaxable: 0, totalVat: 0, totalValue: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchSalesTax = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const res = await apiGet(`/api/reports/sales-tax?${params.toString()}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to fetch sales tax summary');
      }
      setHasTransactions(res.data?.hasTransactions || false);
      setMessage(res.data?.message || 'No sales tax transactions recorded for this period.');
      setSummary(res.data?.summary || { totalTaxable: 0, totalVat: 0, totalValue: 0 });
      setTransactions(res.data?.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Error loading sales tax summary');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchSalesTax();
  }, [fetchSalesTax]);

  const exportCSV = () => {
    if (!hasTransactions || transactions.length === 0) return;
    const headers = ['Invoice #', 'Date', 'Customer', 'VAT Number', 'Taxable Value (₹)', 'VAT Rate (%)', 'VAT Amount (₹)', 'Total Invoice Value (₹)'];
    const rows = transactions.map(tx => [
      tx.invoice_number,
      tx.invoice_date?.split('T')[0],
      tx.customer_name || 'Walk-in',
      tx.vat_number || 'N/A',
      tx.total_taxable_value,
      '5.00%',
      tx.total_vat_amount,
      tx.total_invoice_value,
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sales_Tax_Summary_${fromDate}_to_${toDate}.csv`;
    a.click();
  };

  const copyTable = () => {
    if (!hasTransactions || transactions.length === 0) return;
    const text = transactions
      .map(tx => `${tx.invoice_number}\t${tx.invoice_date?.split('T')[0]}\t${tx.total_taxable_value}\t${tx.total_vat_amount}\t${tx.total_invoice_value}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setFeedback('Summary table copied to clipboard!');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-amber-400" />
            <span>Sales Tax Summary Report (VAT Compliance)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Genuine VAT taxable values, applicable rates, and computed VAT amounts based on verified sales transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSalesTax}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {hasTransactions && (
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

      {/* Filter Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      {hasTransactions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs text-slate-400 font-medium">Total Taxable Value</div>
            <div className="text-xl font-bold font-mono text-white mt-1">₹{summary.totalTaxable.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs text-slate-400 font-medium">Total VAT Amount</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">₹{summary.totalVat.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="text-xs text-slate-400 font-medium">Total Invoice Value</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">₹{summary.totalValue.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Content State */}
      {!hasTransactions ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Sales Tax Transactions Recorded</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{message}</p>
          <div className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 py-2 px-4 rounded-xl inline-block mt-2">
            No fake sales or simulated tax data is generated. Records will appear here automatically when actual POS sales are processed.
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="table-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer / VAT ID</th>
                  <th className="py-3 px-3 text-right">Taxable Value (₹)</th>
                  <th className="py-3 px-3 text-center">VAT Rate</th>
                  <th className="py-3 px-3 text-right">VAT Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{tx.invoice_number}</td>
                    <td className="py-3 px-3 font-sans">{tx.invoice_date?.split('T')[0]}</td>
                    <td className="py-3 px-3 font-sans">
                      <div className="text-white">{tx.customer_name || 'Walk-in'}</div>
                      {tx.vat_number && <div className="text-[11px] text-slate-400">VAT: {tx.vat_number}</div>}
                    </td>
                    <td className="py-3 px-3 text-right">₹{Number(tx.total_taxable_value).toFixed(2)}</td>
                    <td className="py-3 px-3 text-center">5.00%</td>
                    <td className="py-3 px-3 text-right text-amber-400 font-bold">₹{Number(tx.total_vat_amount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">₹{Number(tx.total_invoice_value).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
