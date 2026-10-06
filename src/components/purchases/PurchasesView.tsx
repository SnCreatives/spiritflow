import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowDownToLine,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Layers,
  FileText,
  IndianRupee,
  ShieldCheck,
  Truck,
  Trash2,
  Eye,
  FileEdit,
  X,
  Lock,
  Clipboard,
  Copy,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';
import { UniversalBulkEntryModal, BulkEntryRow } from '../common/UniversalBulkEntryModal';

export interface PurchaseItemRow {
  rowId: string;
  srNo: number;
  product: SelectedProductDetail | null;
  itemNameSnapshot: string;
  scmCode: string;
  size: string;
  qtyCases: number;
  qtyBottles: number;
  batchNumber: string;
  autoBatch: string;
  mfgMonth: string;
  mrp: number;
  bulkLitres: number;
  strengthVv: number;
  totalBottles: number;
  purchaseTpPrice: number;
}

const normalizeDateInput = (dStr?: string): string => {
  if (!dStr) return new Date().toISOString().split('T')[0];
  const trimmed = dStr.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3})[\s\-\/](\d{4})$/i);
  if (dmyMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const m = months[dmyMatch[2].toLowerCase()];
    if (m) {
      const day = dmyMatch[1].padStart(2, '0');
      return `${dmyMatch[3]}-${m}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const numMatch = trimmed.match(/^(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{4})$/);
  if (numMatch) {
    return `${numMatch[3]}-${numMatch[2].padStart(2, '0')}-${numMatch[1].padStart(2, '0')}`;
  }
  return trimmed;
};

export const PurchasesView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Received From Trader / Inward Transport Permit Header Fields
  const [receivedDate, setReceivedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [autoTpNo, setAutoTpNo] = useState<string>('');
  const [manualTpNo, setManualTpNo] = useState<string>('');
  const [tpDate, setTpDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [receivedFrom, setReceivedFrom] = useState<string>('Civilian');
  const [district, setDistrict] = useState<string>('Nanded');
  const [party, setParty] = useState<string>('');
  const [validityDate, setValidityDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');

  // Multi-row Line Items Table
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Modals State
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editParty, setEditParty] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [editManualTp, setEditManualTp] = useState<string>('');

  // Clear component state on bar change
  useEffect(() => {
    setPurchases([]);
    setPurchaseItems([]);
  }, [selectedBar?.id]);

  const fetchPurchases = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const res = await apiGet(`/api/inventory/purchases?barId=${encodeURIComponent(selectedBar.id)}&limit=150`);
      if (res.success) {
        setPurchases(res.data?.purchases || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load received inward transport permits.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, showError]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Add empty line item
  const handleAddRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random()}`,
        srNo: prev.length + 1,
        product: null,
        itemNameSnapshot: '',
        scmCode: '',
        size: '750 ML',
        qtyCases: 1,
        qtyBottles: 0,
        batchNumber: '',
        autoBatch: '',
        mfgMonth: 'Sep-2026',
        mrp: 0,
        bulkLitres: 0,
        strengthVv: 42.8,
        totalBottles: 12,
        purchaseTpPrice: 0,
      },
    ]);
  };

  // Duplicate Row
  const handleDuplicateRow = (index: number) => {
    const item = purchaseItems[index];
    if (!item) return;
    const duplicated: PurchaseItemRow = {
      ...item,
      rowId: `row-${Date.now()}-${Math.random()}`,
      srNo: purchaseItems.length + 1,
    };
    const updated = [...purchaseItems];
    updated.splice(index + 1, 0, duplicated);
    // re-index srNo
    const reindexed = updated.map((r, i) => ({ ...r, srNo: i + 1 }));
    setPurchaseItems(reindexed);
    showSuccess('Row duplicated successfully.');
  };

  // Remove Row
  const handleRemoveRow = (index: number) => {
    const updated = purchaseItems.filter((_, i) => i !== index).map((r, i) => ({ ...r, srNo: i + 1 }));
    setPurchaseItems(updated);
  };

  // Handle Bulk Import / Paste
  const handleAddBulkRows = (rows: BulkEntryRow[], replace: boolean, metadata?: any) => {
    if (metadata) {
      if (metadata.receivedDate) setReceivedDate(normalizeDateInput(metadata.receivedDate));
      if (metadata.autoTpNo) setAutoTpNo(metadata.autoTpNo);
      if (metadata.manualTpNo) setManualTpNo(metadata.manualTpNo);
      if (metadata.tpDate) setTpDate(normalizeDateInput(metadata.tpDate));
      if (metadata.receivedFrom) setReceivedFrom(metadata.receivedFrom);
      if (metadata.district) setDistrict(metadata.district);
      if (metadata.party) setParty(metadata.party);
      if (metadata.validityDate) setValidityDate(normalizeDateInput(metadata.validityDate));
    }

    const newItems: PurchaseItemRow[] = rows.map((r, i) => {
      const cases = r.qtyCases !== undefined && r.qtyCases > 0 ? r.qtyCases : (r.quantity || 1);
      const bottles = r.qtyBottles || 0;
      const totBott = r.totalBottles && r.totalBottles > 0 ? r.totalBottles : (cases * 12 + bottles);

      return {
        rowId: `bulk-${Date.now()}-${i}`,
        srNo: (replace ? 0 : purchaseItems.length) + i + 1,
        product: r.matchedProductId
          ? {
              productId: r.matchedProductId,
              productName: r.matchedProductName || r.variant || 'Imported Product',
              sku: r.scmCode || '',
              productType: r.productType || 'Spirit',
              categoryId: r.categoryId || '',
              categoryName: r.categoryName || '',
              brandId: r.brandId || '',
              brandName: r.brandName || '',
              variant: r.variant || '',
              packSizeId: r.packSizeId || '',
              volumeMl: r.bottleSize || 750,
              packType: r.packaging || 'Bottle',
              mrp: r.mrp || 0,
              purchaseTpPrice: r.purchaseTpPrice || 0,
            }
          : null,
        itemNameSnapshot: r.itemName || r.matchedProductName || (r.brandName ? `${r.brandName} ${r.variant || ''}`.trim() : 'Product'),
        scmCode: r.scmCode || '',
        size: r.bottleSize ? `${r.bottleSize} ML` : '750 ML',
        qtyCases: cases,
        qtyBottles: bottles,
        batchNumber: r.batchNumber || '',
        autoBatch: r.autoBatch || '',
        mfgMonth: r.mfgMonth || 'Sep-2026',
        mrp: r.mrp || 0,
        bulkLitres: r.bulkLitres || 0,
        strengthVv: r.strengthVv || 42.8,
        totalBottles: totBott,
        purchaseTpPrice: r.purchaseTpPrice || r.mrp || 0,
      };
    });

    if (replace) {
      setPurchaseItems(newItems);
    } else {
      setPurchaseItems(prev => [...prev, ...newItems].map((r, i) => ({ ...r, srNo: i + 1 })));
    }
    showSuccess(`Successfully added ${newItems.length} items to Received TP consignment.`);
  };

  // Calculations for Totals Summary
  const summaryTotals = useMemo(() => {
    let totalCases = 0;
    let totalLooseBottles = 0;
    let totalBulkLitres = 0;
    let totalBottles = 0;
    let totalValue = 0;

    for (const item of purchaseItems) {
      totalCases += Number(item.qtyCases || 0);
      totalLooseBottles += Number(item.qtyBottles || 0);
      totalBulkLitres += Number(item.bulkLitres || 0);
      totalBottles += Number(item.totalBottles || 0);
      totalValue += (item.totalBottles || item.qtyCases * 12) * (item.purchaseTpPrice || 0);
    }

    return {
      totalCases,
      totalLooseBottles,
      totalBulkLitres,
      totalBottles,
      totalValue,
    };
  }, [purchaseItems]);

  // Handler: Record Inward Received TP (Atomic Save)
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before creating this transaction.');
      return;
    }

    if (purchaseItems.length === 0) {
      showError('Please add at least one consignment item or use Paste / Import.');
      return;
    }

    // Validate items
    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i];
      if (!item.product) {
        showError(`Row #${i + 1}: Please select or match a canonical product.`);
        return;
      }
      if (item.totalBottles <= 0 && item.qtyCases <= 0) {
        showError(`Row #${i + 1}: Quantity / Cases must be greater than 0.`);
        return;
      }
    }

    setSaving(true);
    try {
      const tpNum = autoTpNo.trim() || (manualTpNo.trim() ? `TP-${manualTpNo.trim()}` : `TP-${Date.now().toString().slice(-6)}`);
      const fullDocRef = party.trim() ? `Party: ${party.trim()} | Dist: ${district.trim()}` : undefined;
      const combinedRemarks = [
        `Received From: ${receivedFrom || 'Civilian'}`,
        `District: ${district || 'Nanded'}`,
        `Party: ${party || 'Consignment'}`,
        `Validity: ${validityDate}`,
        manualTpNo.trim() ? `Manual TP: ${manualTpNo.trim()}` : '',
        remarks.trim(),
      ].filter(Boolean).join(' | ');

      const res = await apiPost('/api/inventory/purchases', {
        barId: selectedBar.id,
        purchaseNumber: tpNum,
        purchaseDate: receivedDate,
        tpPermitReference: autoTpNo.trim() || manualTpNo.trim() || undefined,
        exciseReference: manualTpNo.trim() || undefined,
        documentReference: fullDocRef,
        remarks: combinedRemarks,
        items: purchaseItems.map(item => ({
          productId: item.product!.productId,
          quantity: item.totalBottles > 0 ? item.totalBottles : (item.qtyCases * 12 + item.qtyBottles),
          purchaseTpPrice: Number(item.purchaseTpPrice || item.mrp || 0),
          mrpReference: Number(item.mrp || 0),
          batchNumber: item.batchNumber.trim() || item.autoBatch.trim() || undefined,
        })),
      });

      if (res.success) {
        showSuccess('Received Transport Permit consignment saved atomically to database.');
        // Reset form
        setPurchaseItems([]);
        setAutoTpNo('');
        setManualTpNo('');
        setParty('');
        setRemarks('');
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to record received consignment.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Delete Purchase
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this received consignment? Associated stock will be reverted.')) {
      return;
    }
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await apiDelete(`/api/inventory/purchases/${id}?barId=${encodeURIComponent(selectedBar.id)}`);
      if (res.success) {
        showSuccess('Received consignment deleted successfully.');
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to delete consignment.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to delete consignment.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Update Consignment Details
  const handleUpdate = async () => {
    if (!editingPurchase || !selectedBar?.id) return;
    setSaving(true);
    try {
      const updatedRemarks = [
        editParty.trim() ? `Party: ${editParty.trim()}` : '',
        editManualTp.trim() ? `Manual TP: ${editManualTp.trim()}` : '',
        editRemarks.trim(),
      ].filter(Boolean).join(' | ');

      const res = await apiPut(`/api/inventory/purchases/${editingPurchase.id}`, {
        barId: selectedBar.id,
        remarks: updatedRemarks,
      });

      if (res.success) {
        showSuccess('Consignment updated successfully.');
        setEditingPurchase(null);
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to update consignment.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Excel / CSV Export with Full Received From Trader Format
  const handleExportCSV = () => {
    if (purchases.length === 0 || !selectedBar) return;
    const barName = selectedBar.name;
    let csv = `Received From Trader Consignment Register\n`;
    csv += `Bar: ${barName}\n`;
    csv += `Export Date: ${new Date().toISOString()}\n\n`;
    csv += `Auto T.P. No,Received Date,Manual T.P. No,Party / Supplier,District,Total Value (INR),Remarks\n`;
    purchases.forEach(p => {
      csv += `"${p.purchase_number}","${p.purchase_date}","${p.excise_reference || ''}","${p.document_reference || ''}","${(selectedBar as any).district || district || 'Nanded'}",${p.total_value},"${p.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LiquorFlow_ReceivedTP_${barName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showSuccess('Transport Permit register exported.');
  };

  const filteredPurchases = useMemo(() => {
    if (!search.trim()) return purchases;
    const q = search.toLowerCase();
    return purchases.filter(
      p =>
        p.purchase_number?.toLowerCase().includes(q) ||
        p.tp_permit_reference?.toLowerCase().includes(q) ||
        p.excise_reference?.toLowerCase().includes(q) ||
        p.document_reference?.toLowerCase().includes(q) ||
        p.remarks?.toLowerCase().includes(q)
    );
  }, [purchases, search]);

  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto">
        <div className="p-8 text-center bg-white border border-amber-200 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Specific Bar Selection Required</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Select a specific bar to view or record Transport Permit (TP) inward consignments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <Truck className="w-4 h-4" />
            Received From Trader / Inward Consignment
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Received Transport Permit (TP) Inward
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar.name}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Clipboard className="w-4 h-4" />
            📋 Paste / Import / Excel
          </button>
          <button
            onClick={handleExportCSV}
            disabled={purchases.length === 0}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export TP Register
          </button>
        </div>
      </div>

      {/* Received From Trader Consignment Form */}
      <form onSubmit={handleSubmitPurchase} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              Received From Trader — Header Details
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Official TP Consignment Record</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Received Date *
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={e => setReceivedDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Auto T. P. No
              </label>
              <input
                type="text"
                placeholder="e.g. FL1162-280926/10743"
                value={autoTpNo}
                onChange={e => setAutoTpNo(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                T. P. No (Manual) *
              </label>
              <input
                type="text"
                placeholder="e.g. 10743"
                value={manualTpNo}
                onChange={e => setManualTpNo(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                T. P. Date *
              </label>
              <input
                type="date"
                value={tpDate}
                onChange={e => setTpDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Received From
              </label>
              <input
                type="text"
                placeholder="e.g. Civilian"
                value={receivedFrom}
                onChange={e => setReceivedFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                District
              </label>
              <input
                type="text"
                placeholder="e.g. Nanded"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Party / Supplier Name *
              </label>
              <input
                type="text"
                placeholder="e.g. ALKA WINES-5"
                value={party}
                onChange={e => setParty(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Validity Date *
              </label>
              <input
                type="date"
                value={validityDate}
                onChange={e => setValidityDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Consignment Line Items Table */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                SCM Code Display & Line Items ({purchaseItems.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Supports exact columns: SrNo, ItemName, Size, Qty (Cases), Qty (Bottles), Batch No, Auto Batch, Mfg. Month, MRP, B.L., V/v (%), Tot. Bott.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Row
              </button>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Clipboard className="w-4 h-4" />
                Paste / Import
              </button>
            </div>
          </div>

          {purchaseItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-xs text-slate-600 mb-3">No line items added yet in this consignment.</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-4 py-2 bg-slate-800 text-slate-100 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  + Add First Line
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-amber-400"
                >
                  📋 Paste / Import from Excel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseItems.map((item, index) => (
                <div key={item.rowId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-mono font-bold flex items-center justify-center">
                        {item.srNo}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {item.itemNameSnapshot || item.product?.productName || `Item #${index + 1}`}
                      </span>
                      {item.scmCode && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                          SCM: {item.scmCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(index)}
                        title="Duplicate Row"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-white transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        title="Remove Row"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <CanonicalProductSelector
                    onSelectProduct={prod => {
                      const updated = [...purchaseItems];
                      updated[index].product = prod;
                      if (prod) {
                        updated[index].purchaseTpPrice = prod.purchaseTpPrice || prod.mrp || 0;
                        updated[index].mrp = prod.mrp || 0;
                        updated[index].scmCode = prod.sku || updated[index].scmCode;
                        updated[index].size = prod.volumeMl ? `${prod.volumeMl} ML` : updated[index].size;
                      }
                      setPurchaseItems(updated);
                    }}
                    selectedProductId={item.product?.productId}
                    compact={true}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Size</label>
                      <input
                        type="text"
                        value={item.size}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].size = e.target.value;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Qty (Cases) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.qtyCases}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          const cases = parseFloat(e.target.value) || 0;
                          updated[index].qtyCases = cases;
                          updated[index].totalBottles = Math.round(cases * 12 + (updated[index].qtyBottles || 0));
                          setPurchaseItems(updated);
                        }}
                        required
                        className="w-full px-2 py-1 text-xs font-bold rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Qty (Bottles)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.qtyBottles}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          const loose = parseInt(e.target.value, 10) || 0;
                          updated[index].qtyBottles = loose;
                          updated[index].totalBottles = Math.round((updated[index].qtyCases || 0) * 12 + loose);
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Batch No</label>
                      <input
                        type="text"
                        placeholder="e.g. 485"
                        value={item.batchNumber}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].batchNumber = e.target.value;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Auto Batch</label>
                      <input
                        type="text"
                        placeholder="e.g. BTP1-180926/485"
                        value={item.autoBatch}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].autoBatch = e.target.value;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Mfg. Month</label>
                      <input
                        type="text"
                        placeholder="e.g. Sep-2026"
                        value={item.mfgMonth}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].mfgMonth = e.target.value;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">MRP (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.mrp}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].mrp = parseFloat(e.target.value) || 0;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs font-bold rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Tot. Bott. *</label>
                      <input
                        type="number"
                        min="1"
                        value={item.totalBottles}
                        onChange={e => {
                          const updated = [...purchaseItems];
                          updated[index].totalBottles = parseInt(e.target.value, 10) || 1;
                          setPurchaseItems(updated);
                        }}
                        className="w-full px-2 py-1 text-xs font-black rounded border border-slate-300 bg-white font-mono text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Consignment Totals Summary Footer */}
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Total Cases</span>
                <strong className="text-amber-400 font-bold text-sm">{summaryTotals.totalCases.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Total Loose Bott.</span>
                <strong className="text-slate-200 font-bold text-sm">{summaryTotals.totalLooseBottles}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Total B.L.</span>
                <strong className="text-slate-200 font-bold text-sm">{summaryTotals.totalBulkLitres.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Total Bottles</span>
                <strong className="text-emerald-400 font-black text-base">{summaryTotals.totalBottles}</strong>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase">Total Value (INR)</span>
                <strong className="text-base font-black text-amber-400 font-mono">
                  ₹{summaryTotals.totalValue.toFixed(2)}
                </strong>
              </div>

              <button
                type="submit"
                disabled={saving || purchaseItems.length === 0}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving Consignment...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Received TP Consignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Received Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Auto TP #, Manual TP #, Party..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchPurchases}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">Auto T.P. / PO #</th>
                <th className="px-4 py-3">Received Date</th>
                <th className="px-4 py-3">Manual T.P. #</th>
                <th className="px-4 py-3">Party / Supplier</th>
                <th className="px-4 py-3">Total Value</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading received transport permits...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No received transport permit consignments recorded for {selectedBar.name}.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.purchase_number}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{p.purchase_date}</td>
                    <td className="px-4 py-3 font-mono text-slate-800">{p.excise_reference || p.tp_permit_reference || '—'}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{p.document_reference || '—'}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{Number(p.total_value || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{p.remarks || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setViewingPurchase(p)}
                        title="View Consignment Document"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPurchase(p);
                          setEditParty(p.document_reference || '');
                          setEditManualTp(p.excise_reference || '');
                          setEditRemarks(p.remarks || '');
                        }}
                        title="Edit Remarks / Party"
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors inline-flex items-center cursor-pointer"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        title="Delete Consignment"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors inline-flex items-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Bulk Import Modal */}
      <UniversalBulkEntryModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="purchases"
        language="en"
        onAddRows={handleAddBulkRows}
      />

      {/* View Consignment / Received TP Document Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-fadeIn print:shadow-none print:border-none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 print:hidden">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Transport Permit (TP) Consignment — #{viewingPurchase.purchase_number}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / PDF
                </button>
                <button
                  onClick={() => setViewingPurchase(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible">
              <div className="border-b-2 border-slate-900 pb-3">
                <h2 className="text-lg font-black uppercase text-slate-900">Received From Trader</h2>
                <p className="text-xs text-slate-600 font-semibold">{selectedBar.name} • {(selectedBar as any).district || district || 'Maharashtra'}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Received Date</span>
                  <strong className="text-slate-900">{viewingPurchase.purchase_date}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Auto T. P. No</span>
                  <strong className="text-slate-900 font-bold">{viewingPurchase.purchase_number}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">T. P. No (Manual)</span>
                  <strong className="text-slate-900 font-bold">{viewingPurchase.excise_reference || viewingPurchase.tp_permit_reference || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Party / Supplier</span>
                  <strong className="text-slate-900">{viewingPurchase.document_reference || '—'}</strong>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">SCM Code Display & Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-3 py-2">SrNo</th>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-3 py-2">Qty (Bottles)</th>
                        <th className="px-3 py-2">TP Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPurchase.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-mono text-slate-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            <div>{item.product?.name || item.product_name || 'Product'}</div>
                            {item.product?.sku && (
                              <div className="text-[10px] text-amber-700 font-mono">SCM: {item.product.sku}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{item.quantity}</td>
                          <td className="px-3 py-2 font-mono text-slate-800">₹{item.purchase_tp_price}</td>
                          <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-right">
                            ₹{Number(item.total_price || (item.quantity * item.purchase_tp_price)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right uppercase text-[10px] text-slate-600">
                          Total Consignment Value:
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-emerald-800 text-right text-sm">
                          ₹{Number(viewingPurchase.total_value || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {viewingPurchase.remarks && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Remarks / Metadata:</span>
                  <p className="font-mono text-[11px]">{viewingPurchase.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Consignment Modal */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Edit Received TP Consignment</h3>
              <button
                onClick={() => setEditingPurchase(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Party / Supplier</label>
                <input
                  type="text"
                  value={editParty}
                  onChange={e => setEditParty(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Manual TP #</label>
                <input
                  type="text"
                  value={editManualTp}
                  onChange={e => setEditManualTp(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remarks</label>
                <textarea
                  rows={3}
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingPurchase(null)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
