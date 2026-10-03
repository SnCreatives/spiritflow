import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
  Printer,
  Download,
  Calendar,
  CalendarRange,
  FileText,
  ShieldCheck,
  Receipt,
  Truck,
  TrendingUp,
  Layers,
  Archive,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet } from '../../utils/api';

export type ReportType =
  | 'daily-sales'
  | 'monthly-report'
  | 'excise-log-book'
  | 'sales-tax'
  | 'sales-summary'
  | 'permit-bills'
  | 'received-tp'
  | 'stock-value'
  | 'available-stock';

export const ReportsView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showError, showSuccess } = useToast();

  const [activeReport, setActiveReport] = useState<ReportType>('daily-sales');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);

  // Filter States
  const [singleDate, setSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Clear report data immediately on bar change
  useEffect(() => {
    setReportData(null);
  }, [selectedBar?.id]);

  const fetchReport = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setReportData(null);
    try {
      const barParam = `barId=${encodeURIComponent(selectedBar.id)}`;
      let endpoint = '';

      switch (activeReport) {
        case 'daily-sales':
          endpoint = `/api/reports/daily-sales?${barParam}&date=${singleDate}`;
          break;
        case 'monthly-report':
          endpoint = `/api/reports/monthly?${barParam}&month=${selectedMonth}`;
          break;
        case 'excise-log-book':
          endpoint = `/api/reports/excise-log-book?${barParam}&startDate=${startDate}&endDate=${endDate}`;
          break;
        case 'sales-tax':
          endpoint = `/api/reports/sales-tax?${barParam}&startDate=${startDate}&endDate=${endDate}`;
          break;
        case 'sales-summary':
          endpoint = `/api/reports/sales-summary?${barParam}&startDate=${startDate}&endDate=${endDate}`;
          break;
        case 'permit-bills':
          endpoint = `/api/reports/permit-bills?${barParam}&startDate=${startDate}&endDate=${endDate}`;
          break;
        case 'received-tp':
          endpoint = `/api/reports/received-tp?${barParam}&startDate=${startDate}&endDate=${endDate}`;
          break;
        case 'stock-value':
          endpoint = `/api/reports/stock-value?${barParam}`;
          break;
        case 'available-stock':
          endpoint = `/api/reports/available-stock?${barParam}`;
          break;
      }

      const res = await apiGet(endpoint);
      if (res.success) {
        setReportData(res.data);
      } else {
        throw new Error(res.error?.message || 'Failed to load report data.');
      }
    } catch (err: any) {
      showError(err.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  }, [activeReport, selectedBar?.id, singleDate, startDate, endDate, selectedMonth, showError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!reportData || !selectedBar) return;
    const barName = selectedBar.name;
    let filename = `LiquorFlow_${activeReport}_${barName}_${new Date().toISOString().split('T')[0]}.csv`;
    let csvContent = '';

    if (activeReport === 'excise-log-book') {
      csvContent = `Selected Bar: ${barName}\nPeriod: ${startDate} to ${endDate}\n\n`;
      csvContent += `Serial Number,Date,Spirit / IMFL,Fermented Beer,Mild Beer,Wine,MML,Country Liquor,Total Units\n`;
      (reportData.entries || []).forEach((r: any) => {
        csvContent += `${r.serialNumber},${r.date},${r.spiritImfl},${r.fermentedBeer},${r.mildBeer},${r.wine},${r.mml},${r.countryLiquor},${r.totalUnits}\n`;
      });
      if (reportData.totals) {
        const t = reportData.totals;
        csvContent += `Total,TOTAL,${t.spiritImfl},${t.fermentedBeer},${t.mildBeer},${t.wine},${t.mml},${t.countryLiquor},${t.totalUnits}\n`;
      }
    } else if (activeReport === 'sales-tax') {
      csvContent = `Selected Bar: ${barName}\nPeriod: ${startDate} to ${endDate}\n\n`;
      csvContent += `Category,Taxable Value (INR),VAT Rate (%),VAT Amount (INR),Total Value (INR)\n`;
      (reportData.categories || []).forEach((c: any) => {
        csvContent += `"${c.category}",${c.taxableValue},${c.vatRate}%,${c.vatAmount},${c.totalValue}\n`;
      });
      csvContent += `Total,${reportData.totalTaxable},,${reportData.totalVat},${reportData.totalInvoice}\n`;
    } else if (activeReport === 'stock-value') {
      csvContent = `Selected Bar: ${barName}\nAs of: ${new Date().toLocaleDateString()}\n\n`;
      csvContent += `Product Name,SKU,Category,Brand,Opening,Purchased,Adjustments,Current Stock,TP Cost Price,MRP,TP Value,MRP Value\n`;
      (reportData.items || []).forEach((i: any) => {
        csvContent += `"${i.productName}","${i.sku}","${i.category}","${i.brand}",${i.openingQty},${i.purchasedQty},${i.adjustmentQty},${i.currentQty},${i.purchaseTpPrice},${i.mrp},${i.tpCostValue},${i.mrpTotalValue}\n`;
      });
    } else if (activeReport === 'received-tp') {
      csvContent = `Selected Bar: ${barName}\nPeriod: ${startDate} to ${endDate}\n\n`;
      csvContent += `Purchase Number,Date,TP Permit Ref,Excise Ref,Total Value (INR)\n`;
      (reportData.purchases || []).forEach((p: any) => {
        csvContent += `"${p.purchase_number}","${p.purchase_date}","${p.tp_permit_reference || ''}","${p.excise_reference || ''}",${p.total_value}\n`;
      });
    } else {
      csvContent = `Selected Bar: ${barName}\nExport Date: ${new Date().toISOString()}\n\n`;
      csvContent += JSON.stringify(reportData, null, 2);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Report exported successfully.');
  };

  const handlePrint = () => {
    window.print();
  };

  const navTabs = [
    { id: 'daily-sales', label: 'Daily Sales Report', icon: FileText },
    { id: 'monthly-report', label: 'Monthly Reports', icon: Calendar },
    { id: 'excise-log-book', label: 'Excise Log Book Report', icon: ShieldCheck },
    { id: 'sales-tax', label: 'Sales Tax Report', icon: Receipt },
    { id: 'sales-summary', label: 'Sales Report Summary', icon: TrendingUp },
    { id: 'permit-bills', label: 'Permit Bills', icon: FileSpreadsheet },
    { id: 'received-tp', label: 'Received TP Report', icon: Truck },
    { id: 'stock-value', label: 'Stock Value Report', icon: Layers },
    { id: 'available-stock', label: 'Available Stock Status', icon: Archive },
  ];

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            Excise & ERP Compliance Reports
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Comprehensive Regulatory & Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar?.name || 'All Authorized Bars'}
            </span>
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || !reportData}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !reportData}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* 9 Report Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl border border-slate-300">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Date Filters Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {activeReport === 'daily-sales' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Report Date
              </label>
              <input
                type="date"
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-medium"
              />
            </div>
          ) : activeReport === 'monthly-report' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Select Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-medium"
              />
            </div>
          ) : activeReport === 'stock-value' || activeReport === 'available-stock' ? (
            <div className="text-xs text-slate-500 font-medium">
              Real-time snapshot calculated directly from live database ledger.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-medium"
                />
              </div>
            </>
          )}
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Report Target: <strong className="text-slate-800">{selectedBar?.name}</strong>
        </div>
      </div>

      {/* REPORT CONTENT VIEWPORT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[350px]">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Generating Bar-Scoped Report...
            </p>
          </div>
        ) : !reportData ? (
          <div className="p-12 text-center text-slate-400">
            No data available for this report and date range.
          </div>
        ) : (
          <div>
            {/* 1. Daily Sales Report */}
            {activeReport === 'daily-sales' && (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      Total Transactions
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {reportData.transactionsCount || 0}
                    </span>
                  </div>
                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">
                      Total Sales Revenue
                    </span>
                    <span className="text-2xl font-black text-amber-700">
                      ₹{Number(reportData.totalSalesValue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                      Total VAT Collected
                    </span>
                    <span className="text-2xl font-black text-emerald-700">
                      ₹{Number(reportData.totalVat || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Items Sold</th>
                        <th className="px-4 py-3 text-right">Taxable (₹)</th>
                        <th className="px-4 py-3 text-right">VAT (₹)</th>
                        <th className="px-4 py-3 text-right">Invoice Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.sales || []).map((sale: any) => (
                        <tr key={sale.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {sale.invoice_number}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {sale.customer_name || 'Counter Customer'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {(sale.items || []).map((i: any, idx: number) => (
                              <span key={idx} className="block">
                                {i.product?.name || 'Item'} x{i.quantity}
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            ₹{Number(sale.total_taxable_value || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">
                            ₹{Number(sale.total_vat_amount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            ₹{Number(sale.total_invoice_value || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Monthly Reports */}
            {activeReport === 'monthly-report' && (
              <div className="p-5 space-y-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-800 uppercase block">
                      Month: {reportData.month}
                    </span>
                    <h3 className="text-lg font-black text-slate-900">
                      Total Month-End Stock Valuation
                    </h3>
                  </div>
                  <span className="text-2xl font-black text-amber-700">
                    ₹{Number(reportData.totalValuation || 0).toLocaleString()}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">ML</th>
                        <th className="px-4 py-3 text-right">Opening</th>
                        <th className="px-4 py-3 text-right">Received</th>
                        <th className="px-4 py-3 text-right">Sales</th>
                        <th className="px-4 py-3 text-right">Closing</th>
                        <th className="px-4 py-3 text-right">Valuation (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-900">{item.productName}</td>
                          <td className="px-4 py-3 text-slate-600">{item.productType}</td>
                          <td className="px-4 py-3 text-slate-600">{item.volumeMl} ml</td>
                          <td className="px-4 py-3 text-right font-mono">{item.openingQuantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            +{item.receivedQuantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-700">
                            -{item.salesQuantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {item.closingQuantity}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-700">
                            ₹{Number(item.stockValuation || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Excise Log Book Report (STRICT 7 CANONICAL COLUMNS) */}
            {activeReport === 'excise-log-book' && (
              <div className="p-5 space-y-4">
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium">
                  Official Maharashtra State Excise Log Book Format (Daily Liquors Category Breakdown)
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-3 py-3 text-center">1. Serial #</th>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3 text-right">2. Spirit / IMFL</th>
                        <th className="px-3 py-3 text-right">3. Fermented Beer</th>
                        <th className="px-3 py-3 text-right">4. Mild Beer</th>
                        <th className="px-3 py-3 text-right">5. Wine</th>
                        <th className="px-3 py-3 text-right">6. MML</th>
                        <th className="px-3 py-3 text-right">7. Country Liquor</th>
                        <th className="px-3 py-3 text-right font-black">Total Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(reportData.entries || []).map((entry: any) => (
                        <tr key={entry.serialNumber} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 text-center text-slate-500">
                            {entry.serialNumber}
                          </td>
                          <td className="px-3 py-2.5 font-sans font-medium text-slate-800">
                            {entry.date}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            {entry.spiritImfl}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {entry.fermentedBeer}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {entry.mildBeer}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{entry.wine}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{entry.mml}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {entry.countryLiquor}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-amber-700">
                            {entry.totalUnits}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {reportData.totals && (
                      <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300">
                        <tr>
                          <td colSpan={2} className="px-3 py-3 font-sans uppercase text-xs">
                            Total Units
                          </td>
                          <td className="px-3 py-3 text-right">{reportData.totals.spiritImfl}</td>
                          <td className="px-3 py-3 text-right">{reportData.totals.fermentedBeer}</td>
                          <td className="px-3 py-3 text-right">{reportData.totals.mildBeer}</td>
                          <td className="px-3 py-3 text-right">{reportData.totals.wine}</td>
                          <td className="px-3 py-3 text-right">{reportData.totals.mml}</td>
                          <td className="px-3 py-3 text-right">{reportData.totals.countryLiquor}</td>
                          <td className="px-3 py-3 text-right text-amber-700 font-black">
                            {reportData.totals.totalUnits}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* 4. Sales Tax Report */}
            {activeReport === 'sales-tax' && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      Total Taxable Value
                    </span>
                    <span className="text-xl font-bold text-slate-900">
                      ₹{Number(reportData.totalTaxable || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                      Total VAT Amount
                    </span>
                    <span className="text-xl font-bold text-emerald-700">
                      ₹{Number(reportData.totalVat || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">
                      Total Gross Invoiced
                    </span>
                    <span className="text-xl font-bold text-amber-700">
                      ₹{Number(reportData.totalInvoice || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Tax Classification</th>
                        <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                        <th className="px-4 py-3 text-right">VAT Rate</th>
                        <th className="px-4 py-3 text-right">VAT Amount (₹)</th>
                        <th className="px-4 py-3 text-right font-bold">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.categories || []).map((cat: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-900">{cat.category}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            ₹{Number(cat.taxableValue || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{cat.vatRate}%</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            ₹{Number(cat.vatAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            ₹{Number(cat.totalValue || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Sales Report Summary */}
            {activeReport === 'sales-summary' && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      Total Invoices
                    </span>
                    <span className="text-xl font-bold text-slate-900">
                      {reportData.totalTransactions || 0}
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      Total Units Sold
                    </span>
                    <span className="text-xl font-bold text-slate-900">
                      {reportData.totalUnitsSold || 0}
                    </span>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                      Total VAT
                    </span>
                    <span className="text-xl font-bold text-emerald-700">
                      ₹{Number(reportData.totalVatAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">
                      Gross Revenue
                    </span>
                    <span className="text-xl font-bold text-amber-700">
                      ₹{Number(reportData.totalSalesRevenue || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">Brand</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Units Sold</th>
                        <th className="px-4 py-3 text-right">Taxable (₹)</th>
                        <th className="px-4 py-3 text-right">VAT (₹)</th>
                        <th className="px-4 py-3 text-right font-bold">Total Sales (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.items || []).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-900">{item.productName}</td>
                          <td className="px-4 py-3 text-slate-600">{item.brandName}</td>
                          <td className="px-4 py-3 text-slate-600">{item.categoryName}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {item.totalQuantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            ₹{Number(item.totalTaxable || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            ₹{Number(item.totalVat || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                            ₹{Number(item.totalValue || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. Permit Bills */}
            {activeReport === 'permit-bills' && (
              <div className="p-5 space-y-4">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Bill Number</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3">Permit Number</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3 text-right">Taxable (₹)</th>
                        <th className="px-4 py-3 text-right">VAT (₹)</th>
                        <th className="px-4 py-3 text-right font-bold">Total Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.bills || []).map((bill: any) => (
                        <tr key={bill.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {bill.billNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{bill.date?.split('T')[0]}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {bill.customerName}
                          </td>
                          <td className="px-4 py-3 font-mono text-amber-700">{bill.permitNumber}</td>
                          <td className="px-4 py-3 text-slate-600">{bill.paymentMethod}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            ₹{Number(bill.taxableValue || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            ₹{Number(bill.vatAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            ₹{Number(bill.totalAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. Received TP Report */}
            {activeReport === 'received-tp' && (
              <div className="p-5 space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase block">
                      Total Inward TP Consignments
                    </span>
                    <h3 className="text-lg font-black text-slate-900">
                      Total Received Stock Inward Value
                    </h3>
                  </div>
                  <span className="text-2xl font-black text-emerald-700">
                    ₹{Number(reportData.totalValue || 0).toLocaleString()}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">PO / Invoice #</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">TP Permit Ref</th>
                        <th className="px-4 py-3">Excise Pass Ref</th>
                        <th className="px-4 py-3">Items Received</th>
                        <th className="px-4 py-3 text-right font-bold">Total Inward Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.purchases || []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {p.purchase_number}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.purchase_date}</td>
                          <td className="px-4 py-3 font-mono text-amber-700">
                            {p.tp_permit_reference || 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {p.excise_reference || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {(p.items || []).map((i: any, idx: number) => (
                              <span key={idx} className="block">
                                {i.product?.name || 'Item'} x{i.quantity}
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            ₹{Number(p.total_value || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. Stock Value Report */}
            {activeReport === 'stock-value' && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      Total Active Products
                    </span>
                    <span className="text-xl font-bold text-slate-900">{reportData.totalItems}</span>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="text-[11px] font-bold text-blue-800 uppercase block">
                      Total TP Cost Value
                    </span>
                    <span className="text-xl font-bold text-blue-800">
                      ₹{Number(reportData.totals?.tpCostValuation || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">
                      Total Retail MRP Value
                    </span>
                    <span className="text-xl font-bold text-amber-700">
                      ₹{Number(reportData.totals?.mrpValuation || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-3 py-3">Product Name</th>
                        <th className="px-3 py-3">Category</th>
                        <th className="px-3 py-3">Brand</th>
                        <th className="px-3 py-3 text-right">Current Stock</th>
                        <th className="px-3 py-3 text-right">TP Price (₹)</th>
                        <th className="px-3 py-3 text-right">MRP (₹)</th>
                        <th className="px-3 py-3 text-right">TP Cost Value (₹)</th>
                        <th className="px-3 py-3 text-right font-bold">MRP Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.items || []).map((i: any) => (
                        <tr key={i.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-3 font-bold text-slate-900">{i.productName}</td>
                          <td className="px-3 py-3 text-slate-600">{i.category}</td>
                          <td className="px-3 py-3 text-slate-600">{i.brand}</td>
                          <td className="px-3 py-3 text-right font-mono font-bold">{i.currentQty}</td>
                          <td className="px-3 py-3 text-right font-mono">₹{i.purchaseTpPrice}</td>
                          <td className="px-3 py-3 text-right font-mono">₹{i.mrp}</td>
                          <td className="px-3 py-3 text-right font-mono text-blue-700">
                            ₹{Number(i.tpCostValue || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-amber-700">
                            ₹{Number(i.mrpTotalValue || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 9. Available Stock Status */}
            {activeReport === 'available-stock' && (
              <div className="p-5 space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase block">
                      Total Physical Inventory
                    </span>
                    <h3 className="text-lg font-black text-slate-900">
                      {reportData.totalUnits || 0} Units in Stock
                    </h3>
                  </div>
                  <span className="text-2xl font-black text-amber-700">
                    ₹{Number(reportData.totalValuation || 0).toLocaleString()}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Brand</th>
                        <th className="px-4 py-3 text-right">Opening</th>
                        <th className="px-4 py-3 text-right">Inward</th>
                        <th className="px-4 py-3 text-right">Adjustments</th>
                        <th className="px-4 py-3 text-right font-bold">Current Units</th>
                        <th className="px-4 py-3 text-right font-bold">Stock Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.inventory || []).map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {inv.product?.name || inv.product?.product_name || 'Product'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{inv.product?.sku || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{inv.product?.category?.name || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {inv.product?.brand?.name || inv.product?.brand?.brand_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{inv.opening_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            +{inv.purchased_quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{inv.adjustment_quantity}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                            {inv.current_quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                            ₹{Number(inv.stock_value || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
