import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Printer,
  Package,
  AlertTriangle,
  ArrowDownToLine,
  SlidersHorizontal,
  ShieldCheck,
  QrCode,
  IndianRupee,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { apiGet } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { MlStockReportView } from './MlStockReportView';
import { SalesTaxSummaryView } from './SalesTaxSummaryView';

interface ReportsViewProps {
  language: SupportedLanguage;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ language }) => {
  const t = translations[language];

  const [activeReport, setActiveReport] = useState<
    'ml_stock' | 'sales_tax' | 'current_stock' | 'low_stock' | 'purchases' | 'adjustments' | 'ledger' | 'batches' | 'excise'
  >('ml_stock');

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let json: any;
      if (activeReport === 'current_stock') {
        json = await apiGet('/api/inventory');
        setData(json.data?.items || []);
      } else if (activeReport === 'low_stock') {
        json = await apiGet('/api/inventory?lowStockOnly=true');
        setData(json.data?.items || []);
      } else if (activeReport === 'purchases') {
        json = await apiGet('/api/inventory/purchases');
        setData(json.data?.purchases || []);
      } else if (activeReport === 'adjustments') {
        json = await apiGet('/api/inventory/adjustments');
        setData(json.data?.adjustments || []);
      } else if (activeReport === 'ledger') {
        json = await apiGet('/api/inventory/ledger?limit=150');
        setData(json.data?.ledger || []);
      } else if (activeReport === 'batches') {
        json = await apiGet('/api/batches');
        setData(json.data?.batches || []);
      } else if (activeReport === 'excise') {
        json = await apiGet('/api/excise/licences');
        setData(json.data?.licences || []);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  const exportCSV = () => {
    if (data.length === 0) return;
    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeReport === 'current_stock' || activeReport === 'low_stock') {
      headers = ['Product Name', 'Category', 'Brand', 'Opening Qty', 'Purchased Qty', 'Adjustments', 'Current Stock', 'Valuation (₹)'];
      rows = data.map(item => {
        const p = item.product as any;
        return [
          p?.product_name || p?.name || 'Product',
          p?.category?.name || '-',
          p?.brand?.name || '-',
          item.opening_quantity || 0,
          item.purchased_quantity || 0,
          item.adjustment_quantity || 0,
          item.current_quantity || 0,
          item.stock_value || 0,
        ];
      });
    } else if (activeReport === 'purchases') {
      headers = ['Inward #', 'Date', 'Supplier', 'Permit Ref', 'Total (₹)', 'Remarks'];
      rows = data.map(p => [
        p.purchase_number || '',
        p.purchase_date || '',
        p.supplier?.name || '',
        p.tp_permit_reference || p.excise_reference || '',
        p.total_value || 0,
        p.remarks || '',
      ]);
    } else if (activeReport === 'adjustments') {
      headers = ['Adjustment #', 'Date', 'Product', 'Type', 'Quantity', 'Reason'];
      rows = data.map(a => [
        a.adjustment_number || '',
        a.adjustment_date || '',
        a.product?.name || '',
        a.adjustment_type || '',
        a.quantity || 0,
        a.reason || a.reference || '',
      ]);
    } else if (activeReport === 'ledger') {
      headers = ['Date', 'Product', 'Type', 'Reference', 'Stock In', 'Stock Out', 'Balance'];
      rows = data.map(l => [
        l.transaction_date?.split('T')[0] || '',
        (l.product as any)?.name || '',
        l.transaction_type || '',
        l.reference_number || '',
        l.stock_in || 0,
        l.stock_out || 0,
        l.balance || 0,
      ]);
    } else if (activeReport === 'batches') {
      headers = ['Batch #', 'Date', 'Product', 'Quantity', 'TP Value (₹)', 'Excise Ref'];
      rows = data.map(b => [
        b.batch_number || '',
        b.batch_date || '',
        b.product?.name || '',
        b.quantity || 0,
        b.purchase_tp_value || 0,
        b.excise_reference || '',
      ]);
    } else if (activeReport === 'excise') {
      headers = ['Licence Type', 'Licence Number', 'Holder Name', 'Issued Date', 'Expiry Date', 'Status'];
      rows = data.map(lic => [
        lic.licence_type || '',
        lic.licence_number || '',
        lic.holder_name || '',
        lic.issued_date || '',
        lic.expiry_date || '',
        lic.status || '',
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const reportsList = [
    { id: 'ml_stock', label: 'ML-wise Stock Report', icon: Package },
    { id: 'sales_tax', label: 'Sales Tax Summary', icon: IndianRupee },
    { id: 'current_stock', label: 'Current Stock Report', icon: Package },
    { id: 'low_stock', label: 'Low Stock Alert Report', icon: AlertTriangle },
    { id: 'purchases', label: 'Inward Purchases Report', icon: ArrowDownToLine },
    { id: 'adjustments', label: 'Stock Adjustments Report', icon: SlidersHorizontal },
    { id: 'ledger', label: 'Stock Audit Ledger Report', icon: FileSpreadsheet },
    { id: 'batches', label: 'Batch Lots Report', icon: QrCode },
    { id: 'excise', label: 'Excise Licences Compliance', icon: ShieldCheck },
  ];

  if (activeReport === 'ml_stock') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-wrap gap-2">
          {reportsList.map(rep => {
            const Icon = rep.icon;
            const isActive = activeReport === rep.id;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => setActiveReport(rep.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{rep.label}</span>
              </button>
            );
          })}
        </div>
        <MlStockReportView language={language} />
      </div>
    );
  }

  if (activeReport === 'sales_tax') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-wrap gap-2">
          {reportsList.map(rep => {
            const Icon = rep.icon;
            const isActive = activeReport === rep.id;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => setActiveReport(rep.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{rep.label}</span>
              </button>
            );
          })}
        </div>
        <SalesTaxSummaryView language={language} />
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Excise & Inventory Reports
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Generate printable, exportable audit compliance reports from real database transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchReportData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Reports Selection Pills */}
      <div className="flex flex-wrap gap-2">
        {reportsList.map(rep => {
          const Icon = rep.icon;
          const isActive = activeReport === rep.id;
          return (
            <button
              key={rep.id}
              type="button"
              onClick={() => setActiveReport(rep.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{rep.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {reportsList.find(r => r.id === activeReport)?.label}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {data.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full text-left text-xs text-slate-300">
            {activeReport === 'current_stock' || activeReport === 'low_stock' ? (
              <>
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3 text-right">Opening</th>
                    <th className="px-4 py-3 text-right">Inward</th>
                    <th className="px-4 py-3 text-right">Adjustments</th>
                    <th className="px-4 py-3 text-right font-bold text-white">Current Stock</th>
                    <th className="px-4 py-3 text-right font-bold text-emerald-400">Valuation (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No inventory records found.
                      </td>
                    </tr>
                  ) : (
                    data.map((item: any) => {
                      const p = item.product as any;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">
                            {p?.product_name || p?.name}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{p?.category?.name || '-'}</td>
                          <td className="px-4 py-3 text-slate-400">{p?.brand?.name || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                            {item.opening_quantity || 0}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">
                            +{item.purchased_quantity || 0}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                            {item.adjustment_quantity || 0}
                          </td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-white text-sm">
                            {item.current_quantity || 0}
                          </td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-emerald-400">
                            ₹{Number(item.stock_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </>
            ) : activeReport === 'purchases' ? (
              <>
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Inward #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">TP Permit / Ref</th>
                    <th className="px-4 py-3 text-right font-bold text-white">Total Amount (₹)</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {data.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-amber-300">{p.purchase_number}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{p.purchase_date}</td>
                      <td className="px-4 py-3 text-white font-medium">{p.supplier?.name || '-'}</td>
                      <td className="px-4 py-3 font-mono text-cyan-400">{p.tp_permit_reference || p.excise_reference || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-emerald-400">
                        ₹{Number(p.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{p.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <tbody className="divide-y divide-slate-800/60">
                {data.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500">No records found.</td>
                  </tr>
                ) : (
                  <tr>
                    <td className="px-4 py-4 text-center text-slate-300">
                      Loaded {data.length} records. Click &quot;Export CSV&quot; to download the complete audited dataset.
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
