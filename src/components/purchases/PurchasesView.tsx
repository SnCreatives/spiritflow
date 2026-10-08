import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Eye,
  FileEdit,
  X,
  Clipboard,
  Printer,
  Copy,
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [search, setSearch] = useState('');

  // Add / Create Modal State
  const [showAddForm, setShowAddForm] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Header Details
  const [receivedDate, setReceivedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [autoTpNo, setAutoTpNo] = useState<string>('');
  const [manualTpNo, setManualTpNo] = useState<string>('');
  const [tpDate, setTpDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [receivedFrom, setReceivedFrom] = useState<string>('Civilian');
  const [district, setDistrict] = useState<string>('Nanded');
  const [party, setParty] = useState<string>('');
  const [validityDate, setValidityDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');

  // Line items
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);

  // Modals
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editParty, setEditParty] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [editManualTp, setEditManualTp] = useState<string>('');

  // Reset when bar changes
  useEffect(() => {
    setPurchases([]);
    setPurchaseItems([]);
    setShowAddForm(false);
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
      showError(err.message || 'Failed to load received stock records.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, showError]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleOpenAddForm = () => {
    setShowAddForm(true);
    if (purchaseItems.length === 0) {
      handleAddRow();
    }
  };

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
    setPurchaseItems(updated.map((r, i) => ({ ...r, srNo: i + 1 })));
    showSuccess('Row duplicated.');
  };

  const handleRemoveRow = (index: number) => {
    const updated = purchaseItems.filter((_, i) => i !== index).map((r, i) => ({ ...r, srNo: i + 1 }));
    setPurchaseItems(updated);
  };

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
      setPurchaseItems(prev => [...prev.filter(p => p.product !== null || p.itemNameSnapshot), ...newItems].map((r, i) => ({ ...r, srNo: i + 1 })));
    }
    showSuccess(`Added ${newItems.length} items from paste/import.`);
  };

  const summaryTotals = useMemo(() => {
    let totalCases = 0;
    let totalLooseBottles = 0;
    let totalBottles = 0;
    let totalValue = 0;

    for (const item of purchaseItems) {
      totalCases += Number(item.qtyCases || 0);
      totalLooseBottles += Number(item.qtyBottles || 0);
      totalBottles += Number(item.totalBottles || 0);
      totalValue += (item.totalBottles || item.qtyCases * 12) * (item.purchaseTpPrice || item.mrp || 0);
    }

    return { totalCases, totalLooseBottles, totalBottles, totalValue };
  }, [purchaseItems]);

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar first.');
      return;
    }

    if (purchaseItems.length === 0) {
      showError('Please add at least one line item.');
      return;
    }

    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i];
      if (!item.product) {
        showError(`Row #${i + 1}: Please select a product.`);
        return;
      }
      if (item.totalBottles <= 0 && item.qtyCases <= 0) {
        showError(`Row #${i + 1}: Quantity must be greater than zero.`);
        return;
      }
    }

    setSaveStatus('saving');
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
          scmCode: item.scmCode?.trim() || undefined,
        })),
      });

      if (res.success) {
        setSaveStatus('saved');
        showSuccess('Received stock saved successfully.');
        // Reset form and close
        setPurchaseItems([]);
        setAutoTpNo('');
        setManualTpNo('');
        setParty('');
        setRemarks('');
        setShowAddForm(false);
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to save received consignment.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
      setSaveStatus('idle');
    } finally {
      setTimeout(() => setSaveStatus('idle'), 1500);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this received stock consignment? Associated inventory will be reverted.')) {
      return;
    }
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await apiDelete(`/api/inventory/purchases/${id}?barId=${encodeURIComponent(selectedBar.id)}`);
      if (res.success) {
        showSuccess('Consignment deleted.');
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Failed to delete.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to delete consignment.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPurchase || !selectedBar?.id) return;
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
        showSuccess('Consignment updated.');
        setEditingPurchase(null);
        fetchPurchases();
      } else {
        throw new Error(res.error?.message || 'Update failed.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to update.');
    }
  };

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
    a.download = `ReceivedStock_${barName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showSuccess('Export downloaded.');
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
      <div className="px-4 sm:px-6 py-12 max-w-xl mx-auto text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Select a Bar</h2>
          <p className="text-xs text-slate-500">
            Please choose a specific bar outlet to view and add received stock.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Received Stock</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add received stock from trader (Inward Transport Permit).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={purchases.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Received Stock</span>
          </button>
        </div>
      </div>

      {/* Filters / Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Auto TP #, Manual TP #, Party..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
          />
        </div>

        <button
          type="button"
          onClick={fetchPurchases}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 w-full sm:w-auto justify-center cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Content: Records Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Auto T.P. No</th>
                <th className="px-4 py-2.5">Received Date</th>
                <th className="px-4 py-2.5">Manual T.P. #</th>
                <th className="px-4 py-2.5">Party / Supplier</th>
                <th className="px-4 py-2.5 text-right">Total Value (₹)</th>
                <th className="px-4 py-2.5">Remarks</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading received stock consignments...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No received stock records found. Click "+ Add Received Stock" to enter inward stock.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">{p.purchase_number}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{p.purchase_date}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">{p.excise_reference || p.tp_permit_reference || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.document_reference || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                      ₹{Number(p.total_value || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">{p.remarks || '—'}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingPurchase(p)}
                        title="View Consignment"
                        className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPurchase(p);
                          setEditParty(p.document_reference || '');
                          setEditManualTp(p.excise_reference || '');
                          setEditRemarks(p.remarks || '');
                        }}
                        title="Edit Details"
                        className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        title="Delete Consignment"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
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

      {/* 3. FORMS MUST BE SIMPLE: Add Received Stock Form (Full Screen / Modal) */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Add Received Stock</h2>
                <p className="text-[11px] text-slate-500">Record inward stock from trader</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Paste from Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form id="received-stock-form" onSubmit={handleSubmitPurchase} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Basic Details Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                  Basic Details
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Received Date *</label>
                    <input
                      type="date"
                      value={receivedDate}
                      onChange={e => setReceivedDate(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Auto T. P. No</label>
                    <input
                      type="text"
                      placeholder="e.g. FL1162-280926/10743"
                      value={autoTpNo}
                      onChange={e => setAutoTpNo(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">T. P. No (Manual) *</label>
                    <input
                      type="text"
                      placeholder="e.g. 10743"
                      value={manualTpNo}
                      onChange={e => setManualTpNo(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">T. P. Date *</label>
                    <input
                      type="date"
                      value={tpDate}
                      onChange={e => setTpDate(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Received From</label>
                    <input
                      type="text"
                      placeholder="e.g. Civilian"
                      value={receivedFrom}
                      onChange={e => setReceivedFrom(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">District</label>
                    <input
                      type="text"
                      placeholder="e.g. Nanded"
                      value={district}
                      onChange={e => setDistrict(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Party / Supplier *</label>
                    <input
                      type="text"
                      placeholder="e.g. ALKA WINES-5"
                      value={party}
                      onChange={e => setParty(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Validity Date *</label>
                    <input
                      type="date"
                      value={validityDate}
                      onChange={e => setValidityDate(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Items ({purchaseItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {purchaseItems.map((item, index) => (
                    <div key={item.rowId} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center">
                            {item.srNo}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {item.itemNameSnapshot || item.product?.productName || `Item #${index + 1}`}
                          </span>
                          {item.scmCode && (
                            <span className="text-[10px] font-mono text-slate-500">
                              (SCM: {item.scmCode})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateRow(index)}
                            title="Duplicate"
                            className="p-1 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            title="Delete"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                            // Preserve existing pasted/entered SCM code; fallback to product sku only if empty
                            updated[index].scmCode = updated[index].scmCode || prod.sku || '';
                            updated[index].size = prod.volumeMl ? `${prod.volumeMl} ML` : updated[index].size;
                          }
                          setPurchaseItems(updated);
                        }}
                        selectedProductId={item.product?.productId}
                        compact={true}
                      />

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-semibold">SCM Code</label>
                          <input
                            type="text"
                            placeholder="e.g. SCMBR0021298"
                            value={item.scmCode || ''}
                            onChange={e => {
                              const updated = [...purchaseItems];
                              updated[index].scmCode = e.target.value.trim().toUpperCase();
                              setPurchaseItems(updated);
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-semibold">Qty (Cases) *</label>
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
                            className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-semibold">Qty (Bottles)</label>
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
                            className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-semibold">Batch No</label>
                          <input
                            type="text"
                            placeholder="e.g. 485"
                            value={item.batchNumber}
                            onChange={e => {
                              const updated = [...purchaseItems];
                              updated[index].batchNumber = e.target.value;
                              setPurchaseItems(updated);
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-semibold">MRP (₹)</label>
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
                            className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-semibold">Tot. Bottles *</label>
                          <input
                            type="number"
                            min="1"
                            value={item.totalBottles}
                            onChange={e => {
                              const updated = [...purchaseItems];
                              updated[index].totalBottles = parseInt(e.target.value, 10) || 1;
                              setPurchaseItems(updated);
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Summary */}
                <div className="mt-4 p-3 bg-slate-100 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <span>Total Cases: <strong className="font-mono">{summaryTotals.totalCases.toFixed(2)}</strong></span>
                    <span>Total Loose: <strong className="font-mono">{summaryTotals.totalLooseBottles}</strong></span>
                    <span>Total Bottles: <strong className="font-mono">{summaryTotals.totalBottles}</strong></span>
                  </div>
                  <div>
                    <span>Total Value: <strong className="font-mono font-bold text-slate-900">₹{summaryTotals.totalValue.toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>
            </form>

            {/* 5. SAVE BUTTON: ONE obvious primary Save button */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="received-stock-form"
                disabled={saveStatus === 'saving'}
                className="px-5 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalBulkEntryModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="purchases"
        language="en"
        onAddRows={handleAddBulkRows}
      />

      {/* View Consignment Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden print:shadow-none print:border-none">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 print:hidden">
              <h3 className="text-xs font-bold text-slate-900">
                Transport Permit #{viewingPurchase.purchase_number}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingPurchase(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase">Received From Trader</h2>
                <p className="text-slate-500">{selectedBar.name} • {(selectedBar as any).district || district || 'Maharashtra'}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase">Date</span>
                  <span className="font-semibold text-slate-800">{viewingPurchase.purchase_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase">Auto T.P. #</span>
                  <span className="font-semibold text-slate-800">{viewingPurchase.purchase_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase">Manual T.P. #</span>
                  <span className="font-semibold text-slate-800">{viewingPurchase.excise_reference || viewingPurchase.tp_permit_reference || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase">Party / Supplier</span>
                  <span className="font-semibold text-slate-800">{viewingPurchase.document_reference || '—'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase mb-1.5">Remarks</h4>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-[11px]">
                  {viewingPurchase.remarks || 'No remarks provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Consignment Details Modal */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase">Edit Consignment Details</h3>
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Party / Supplier</label>
                <input
                  type="text"
                  value={editParty}
                  onChange={e => setEditParty(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Manual TP Number</label>
                <input
                  type="text"
                  value={editManualTp}
                  onChange={e => setEditManualTp(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Remarks</label>
                <textarea
                  rows={3}
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
