import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  PlusCircle,
  FileEdit,
  CalendarRange,
  Archive,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Printer,
  FileSpreadsheet,
  Download,
  Layers,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  Lock,
  ChevronRight,
  Clipboard
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';
import { ModalShell } from '../common/ModalShell';

import { UniversalBulkEntryModal, BulkEntryRow } from '../common/UniversalBulkEntryModal';

type SubTab = 'add-sale' | 'daily-sales' | 'range-sales' | 'closing-sales';

export const SalesTransactionView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<SubTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'daily' || tab === 'daily-sales') return 'daily-sales';
    if (tab === 'range' || tab === 'range-sales') return 'range-sales';
    if (tab === 'closing' || tab === 'closing-sales') return 'closing-sales';
    return 'add-sale';
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Sync tab with URL search parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'daily' || tab === 'daily-sales') setActiveTab('daily-sales');
    else if (tab === 'range' || tab === 'range-sales') setActiveTab('range-sales');
    else if (tab === 'closing' || tab === 'closing-sales') setActiveTab('closing-sales');
    else if (!tab || tab === 'add' || tab === 'add-sale') setActiveTab('add-sale');
  }, [window.location.search]);

  const handleTabChange = (tab: SubTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.pathname + url.search);
  };

  // Tab 1: Add Sale Form State
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');

  const handleAddBulkRows = async (rows: BulkEntryRow[], replace: boolean) => {
    if (!selectedBar?.id) return;
    
    setSubmitting(true);
    try {
      const items = rows.map(r => ({
        productId: r.matchedProductId!,
        quantity: r.quantity,
        rate: r.mrp || 0,
      }));

      const res = await apiPost('/api/sales', {
        barId: selectedBar.id,
        saleDate,
        remarks: 'Bulk imported sales entry',
        items,
      });

      if (res.success) {
        showSuccess(`Successfully imported ${items.length} sales rows.`);
        fetchDailySales();
        handleTabChange('daily-sales');
      } else {
        throw new Error(res.error?.message || 'Bulk import failed');
      }
    } catch (err: any) {
      showError(err.message || 'Import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tab 2: Daily Sales State
  const [dailyDate, setDailyDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [searchSale, setSearchSale] = useState<string>('');
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);

  // Tab 3: Range Sales State
  const [rangeSalesData, setRangeSalesData] = useState<any[]>([]);
  const [rangeStartDate, setRangeStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [rangeEndDate, setRangeEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Tab 4: Closing Sales & Dry Day State
  const [closingStartDate, setClosingStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [closingEndDate, setClosingEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showZeroStock, setShowZeroStock] = useState<boolean>(false);
  const [closingStockItems, setClosingStockItems] = useState<any[]>([]);
  const [dryDays, setDryDays] = useState<any[]>([]);
  const [newDryDate, setNewDryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newDryReason, setNewDryReason] = useState<string>('State Excise Mandated Dry Day');
  const [showDryModal, setShowDryModal] = useState<boolean>(false);

  // Clear component operational states on active bar change
  useEffect(() => {
    setSalesList([]);
    setRangeSalesData([]);
    setClosingStockItems([]);
    setAvailableStock(null);
    setSelectedProduct(null);
  }, [selectedBar?.id]);

  // Fetch Available Stock for Selected Product in Selected Bar
  useEffect(() => {
    if (!selectedBar?.id || !selectedProduct?.productId) {
      setAvailableStock(null);
      return;
    }

    let isMounted = true;
    setCheckingStock(true);

    const fetchStock = async () => {
      try {
        const res = await apiGet(`/api/inventory?productId=${selectedProduct.productId}&barId=${encodeURIComponent(selectedBar.id)}`);
        if (isMounted) {
          const invList = res.data?.items || res.data || [];
          const match = invList.find((i: any) => i.product_id === selectedProduct.productId);
          const stock = match ? Number(match.current_quantity || 0) : 0;
          setAvailableStock(stock);
        }
      } catch (err) {
        console.error('Failed to fetch product stock:', err);
        if (isMounted) setAvailableStock(0);
      } finally {
        if (isMounted) setCheckingStock(false);
      }
    };

    fetchStock();
    return () => {
      isMounted = false;
    };
  }, [selectedBar?.id, selectedProduct?.productId]);

  // Update default unit price when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setUnitPrice(selectedProduct.mrp || 0);
    }
  }, [selectedProduct]);

  // Calculations for Add Sale
  const vatRate = useMemo(() => {
    if (!selectedProduct) return 5;
    // Wine is strictly 0% sales tax according to excise rules
    if (selectedProduct.productType === 'Wine') return 0;
    return 5;
  }, [selectedProduct]);

  const taxableValue = useMemo(() => {
    const gross = quantity * unitPrice;
    if (vatRate === 0) return gross;
    return Math.round((gross / (1 + vatRate / 100)) * 100) / 100;
  }, [quantity, unitPrice, vatRate]);

  const vatAmount = useMemo(() => {
    const gross = quantity * unitPrice;
    return Math.round((gross - taxableValue) * 100) / 100;
  }, [quantity, unitPrice, taxableValue]);

  const totalAmount = useMemo(() => {
    return Math.round(quantity * unitPrice * 100) / 100;
  }, [quantity, unitPrice]);

  // Handler: Add Sale
  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') {
      showError('Please select a specific bar before creating this transaction.');
      return;
    }

    if (!selectedProduct) {
      showError('Please select a valid product using the cascading selector.');
      return;
    }

    if (quantity <= 0) {
      showError('Quantity must be greater than 0.');
      return;
    }

    if (availableStock !== null && quantity > availableStock) {
      showError(`Insufficient stock. Current available: ${availableStock} units.`);
      return;
    }

      setSubmitting(true);
      setSaveStatus('saving');
      try {
        const payload = {
          barId: selectedBar.id,
          saleDate: saleDate,
          remarks: remarks.trim() || undefined,
          items: [
            {
              productId: selectedProduct.productId,
              quantity,
              rate: unitPrice,
            },
          ],
        };

        const res = await apiPost('/api/sales', payload);
        if (res.success) {
          setSaveStatus('saved');
          showSuccess('Sale transaction recorded successfully.');
          // Reset form
          setQuantity(1);
          setRemarks('');
          // Update live available stock
          if (availableStock !== null) {
            setAvailableStock(Math.max(0, availableStock - quantity));
          }
        } else {
          throw new Error(res.error?.message || 'Failed to save sales transaction.');
        }
      } catch (err: any) {
        showError(err.message || 'Unable to save. Please try again.');
        setSaveStatus('idle');
      } finally {
        setSubmitting(false);
        setTimeout(() => setSaveStatus('idle'), 1500);
      }
  };

  // Fetch Sales for Daily Sales Tab
  const fetchDailySales = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/sales?barId=${encodeURIComponent(selectedBar.id)}&startDate=${dailyDate}&endDate=${dailyDate}&search=${encodeURIComponent(searchSale)}&limit=100`
      );
      if (res.success) {
        setSalesList(res.data?.sales || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load daily sales.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, dailyDate, searchSale, showError]);

  useEffect(() => {
    if (activeTab === 'daily-sales' && selectedBar?.id && selectedBar.id !== 'ALL_BARS') {
      fetchDailySales();
    }
  }, [activeTab, selectedBar?.id, fetchDailySales]);

  // Handler: Update Sale Quantity
  const handleUpdateSaleSubmit = async () => {
    if (!editingSale || !selectedBar?.id) return;
    setSubmitting(true);
    try {
      const currentItem = editingSale.items?.[0];
      const res = await apiPut(`/api/sales/${editingSale.id}`, {
        barId: selectedBar.id,
        items: [
          {
            id: currentItem?.id,
            productId: currentItem?.product_id,
            quantity: editQuantity,
            unitPrice: Number(currentItem?.unit_price || 0),
          },
        ],
      });

      if (res.success) {
        showSuccess('Changes updated successfully.');
        setEditingSale(null);
        fetchDailySales();
      } else {
        throw new Error(res.error?.message || 'Failed to update sale.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler: Delete Sale
  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sales transaction? Stock will be restored.')) {
      return;
    }
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const res = await apiDelete(`/api/sales/${id}?barId=${encodeURIComponent(selectedBar.id)}`);
      if (res.success) {
        showSuccess('Sale deleted successfully and stock restored.');
        fetchDailySales();
      } else {
        throw new Error(res.error?.message || 'Failed to delete sale.');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to delete sale transaction.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Range Sales
  const fetchRangeSales = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/reports/sales-summary?barId=${encodeURIComponent(selectedBar.id)}&startDate=${rangeStartDate}&endDate=${rangeEndDate}`
      );
      if (res.success) {
        setRangeSalesData(res.data?.items || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to generate range sales summary.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, rangeStartDate, rangeEndDate, showError]);

  useEffect(() => {
    if (activeTab === 'range-sales' && selectedBar?.id && selectedBar.id !== 'ALL_BARS') {
      fetchRangeSales();
    }
  }, [activeTab, selectedBar?.id, fetchRangeSales]);

  // Fetch Closing Sales & Dry Days
  const fetchClosingStock = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const [closeRes, dryRes] = await Promise.all([
        apiGet(
          `/api/sales/closing-stock?barId=${encodeURIComponent(selectedBar.id)}&startDate=${closingStartDate}&endDate=${closingEndDate}`
        ),
        apiGet(`/api/dry-days?barId=${encodeURIComponent(selectedBar.id)}`),
      ]);

      if (closeRes.success) {
        setClosingStockItems(closeRes.data?.closingStock || []);
      }
      if (dryRes.success) {
        setDryDays(dryRes.data?.dryDays || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to calculate closing stock.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, closingStartDate, closingEndDate, showError]);

  useEffect(() => {
    if (activeTab === 'closing-sales' && selectedBar?.id && selectedBar.id !== 'ALL_BARS') {
      fetchClosingStock();
    }
  }, [activeTab, selectedBar?.id, fetchClosingStock]);

  // Handler: Add Dry Day
  const handleAddDryDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;

    try {
      const res = await apiPost('/api/dry-days', {
        barId: selectedBar.id,
        dryDate: newDryDate,
        reason: newDryReason.trim(),
      });
      if (res.success) {
        showSuccess('Dry day added successfully.');
        setShowDryModal(false);
        fetchClosingStock();
      } else {
        throw new Error(res.error?.message || 'Failed to add dry day');
      }
    } catch (err: any) {
      showError(err.message || 'Unable to save dry day.');
    }
  };

  // Filtered Closing Items
  const displayedClosingItems = useMemo(() => {
    if (showZeroStock) return closingStockItems;
    return closingStockItems.filter(i => i.closingQuantity > 0 || i.salesQuantity > 0 || i.openingQuantity > 0);
  }, [closingStockItems, showZeroStock]);

  const handleExportDailyCSV = () => {
    if (salesList.length === 0 || !selectedBar) return;
    const barName = selectedBar.name;
    let csv = `Daily Sales Report - ${dailyDate}\n`;
    csv += `Bar: ${barName}\n`;
    csv += `Export Date: ${new Date().toISOString()}\n\n`;
    csv += `Time,Product Type,Brand,Variant,Size,SCM Code,Quantity\n`;
    
    salesList.forEach(sale => {
      const time = new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      (sale.items || []).forEach((item: any) => {
        csv += `"${time}","${item.product?.category?.name || 'Spirit'}","${item.product?.brand?.name || item.product?.brand_name || ''}","${item.product?.product_name || item.product?.name || ''}","${item.product?.pack_size?.name || item.product?.size || ''}","${item.product?.sku || item.product?.scm_code || ''}",${item.quantity}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DailySales_${barName}_${dailyDate}.csv`;
    a.click();
    showSuccess('Daily sales export downloaded.');
  };

  const handleExportRangeCSV = () => {
    if (rangeSalesData.length === 0 || !selectedBar) return;
    const barName = selectedBar.name;
    let csv = `Range Sales Summary: ${rangeStartDate} to ${rangeEndDate}\n`;
    csv += `Bar: ${barName}\n`;
    csv += `Export Date: ${new Date().toISOString()}\n\n`;
    csv += `Product Type,Brand,Variant,Size,Units Sold,Total Value\n`;
    
    rangeSalesData.forEach(item => {
      csv += `"${item.categoryName || 'Spirit'}","${item.brandName}","${item.productName}","${item.volumeMl || ''} ml",${item.totalQuantity},${item.totalValue}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RangeSales_${barName}_${rangeStartDate}_to_${rangeEndDate}.csv`;
    a.click();
    showSuccess('Range sales export downloaded.');
  };

  // Guard for ALL_BARS selection
  if (!selectedBar || selectedBar.id === 'ALL_BARS') {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto">
        <div className="p-8 text-center bg-white border border-amber-200 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Specific Bar Selection Required</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Select a specific bar to create or modify operational transactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8 font-sans text-slate-700">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 bg-amber-500 rounded-full"></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Sales Ledger</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Daily counter transactions and operational sales register for <span className="text-slate-900 font-bold">{selectedBar.name}</span>.
          </p>
        </div>

        {/* Subtab Navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => handleTabChange('add-sale')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'add-sale'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="uppercase tracking-wider">New Sale</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('daily-sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'daily-sales'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="uppercase tracking-wider">Daily</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('range-sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'range-sales'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span className="uppercase tracking-wider">Summary</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('closing-sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'closing-sales'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span className="uppercase tracking-wider">Closing</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADD SALE */}
      {activeTab === 'add-sale' && (
        <form onSubmit={handleAddSale} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-amber-500 rounded-full"></div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Inventory Outward entry</div>
            </div>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 transition-all active:scale-95"
            >
              <Clipboard className="w-4 h-4" />
              <span>Paste from Excel</span>
            </button>
          </div>

          {/* Step 1: Canonical Product Selector */}
          <CanonicalProductSelector
            onSelectProduct={prod => setSelectedProduct(prod)}
            selectedProductId={selectedProduct?.productId}
          />

          {/* Step 2: Transaction Details Form Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/10">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Sale Parameters
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Entry Verification</p>
                </div>
              </div>
              
              {availableStock !== null && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Availability</div>
                    <div className={`text-sm font-black font-mono ${availableStock > 0 ? 'text-emerald-600' : 'text-rose-500 animate-pulse'}`}>
                      {availableStock} Units
                    </div>
                  </div>
                  <div className={`w-2 h-10 rounded-full ${availableStock > 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}></div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Sale Posting Date *
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Units / Bottles *
                </label>
                <input
                  type="number"
                  min="1"
                  max={availableStock !== null && availableStock > 0 ? availableStock : 9999}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                />
              </div>

              {/* Unit MRP / Selling Price */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Unit MRP (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                />
              </div>

              {/* Remaining Stock (Calculated) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Post-Sale Balance
                </label>
                <div className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 font-mono font-black text-slate-500 shadow-inner flex items-center justify-between">
                  <span>{availableStock !== null ? Math.max(0, availableStock - quantity) : '—'}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Bottles</span>
                </div>
              </div>

              {/* Remarks */}
              <div className="sm:col-span-4 space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Audit Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional operational reference for this transaction..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Calculations Breakdown and Save Button */}
            <div className="p-6 bg-slate-900 rounded-[2rem] shadow-2xl shadow-slate-900/20 flex flex-wrap items-center justify-between gap-8 border border-slate-800">
              <div className="flex items-center gap-10">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Net Revenue</div>
                  <div className="flex items-baseline gap-1 text-white">
                    <span className="text-sm font-bold text-slate-400">₹</span>
                    <span className="text-3xl font-black font-mono tracking-tighter">{taxableValue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="h-12 w-px bg-slate-800/50"></div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Sales Tax ({vatRate}%)</div>
                  <div className="flex items-baseline gap-1 text-white">
                    <span className="text-sm font-bold text-slate-400">₹</span>
                    <span className="text-3xl font-black font-mono tracking-tighter">{vatAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-2">Gross Transaction Value</div>
                  <div className="text-4xl font-black text-amber-500 font-mono tracking-tighter">
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* 5. SAVE BUTTON: ONE obvious primary Save button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-12 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {saveStatus === 'saving' ? 'Processing...' : saveStatus === 'saved' ? 'Posted ✓' : 'Post Transaction'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: DAILY SALES */}
      {activeTab === 'daily-sales' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Date Selector Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Active Sale Date
                </label>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={e => setDailyDate(e.target.value)}
                  className="px-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
              <div className="space-y-1.5 flex-1 md:w-80">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Filter Ledger
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search product variant name..."
                    value={searchSale}
                    onChange={e => setSearchSale(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={handleExportDailyCSV}
                disabled={salesList.length === 0}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-black text-slate-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs uppercase tracking-widest"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={fetchDailySales}
                disabled={loading}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl border border-transparent shadow-lg shadow-slate-900/10 transition-all cursor-pointer uppercase tracking-widest"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {/* Daily Sales Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Post Time</th>
                    <th className="px-6 py-4">Identity</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Bottle Size</th>
                    <th className="px-6 py-4">SCM Code</th>
                    <th className="px-6 py-4 text-right">Sold Qty</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-8 h-8 text-slate-200 animate-spin" />
                          <span className="text-slate-400 font-bold uppercase tracking-tighter">Scanning daily sales registry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : salesList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6" />
                          </div>
                          <p className="font-medium">No sales transactions recorded for {dailyDate}.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    salesList.map(sale => (
                      <React.Fragment key={sale.id}>
                        {(sale.items || []).map((item: any, idx: number) => (
                          <tr key={`${sale.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-slate-400 font-mono font-bold">
                              {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 uppercase tracking-tight">{item.product?.product_name || item.product?.name || '—'}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{item.product?.brand?.name || item.product?.brand_name || '—'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-tighter">
                                {item.product?.category?.name || 'Spirit'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold">
                              {item.product?.pack_size?.name || item.product?.size || '—'}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-400 font-medium tracking-tighter">
                              {item.product?.sku || item.product?.scm_code || '—'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-100 rounded-lg font-mono font-black text-sm">
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingSale(sale);
                                    setEditQuantity(Number(item.quantity || 1));
                                  }}
                                  className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer shadow-xs"
                                  title="Correct Entry"
                                >
                                  <FileEdit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSale(sale.id)}
                                  className="p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer shadow-xs"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Sale Modal */}
          <ModalShell
            isOpen={!!editingSale}
            onClose={() => setEditingSale(null)}
            title="Correct Sale Entry"
            subtitle={`Invoice: ${editingSale?.invoice_number || 'Internal Ref'}`}
            icon={<FileEdit className="w-5 h-5" />}
            maxWidth="max-w-md"
            footer={
              <div className="flex justify-end gap-3 w-full">
                <button
                  onClick={() => setEditingSale(null)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-black transition-all uppercase tracking-widest"
                >
                  Discard
                </button>
                <button
                  onClick={handleUpdateSaleSubmit}
                  disabled={submitting}
                  className="px-10 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 active:scale-95 uppercase tracking-widest"
                >
                  {submitting ? 'SYNCING...' : 'Update & Rebalance'}
                </button>
              </div>
            }
          >
            {editingSale && (
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Product Identity</div>
                  <div className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                    {editingSale.items?.[0]?.product?.name || 'Consignment Item'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                    Corrected Physical Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={e => setEditQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                  />
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                      Inventory valuation & Stock ledger will be rebalanced automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ModalShell>
        </div>
      )}

      {/* TAB 3: RANGE SALES */}
      {activeTab === 'range-sales' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={rangeStartDate}
                  onChange={e => setRangeStartDate(e.target.value)}
                  className="px-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={rangeEndDate}
                  onChange={e => setRangeEndDate(e.target.value)}
                  className="px-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={handleExportRangeCSV}
                disabled={rangeSalesData.length === 0}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-black text-slate-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs uppercase tracking-widest"
              >
                <Download className="w-4 h-4" />
                <span>Export Summary</span>
              </button>
              <button
                onClick={fetchRangeSales}
                disabled={loading}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl border border-transparent shadow-lg shadow-slate-900/10 transition-all cursor-pointer uppercase tracking-widest"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Process Report</span>
              </button>
            </div>
          </div>

          {/* Range Sales Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Brand Identity</th>
                    <th className="px-6 py-4">Variant</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Units Sold</th>
                    <th className="px-6 py-4 text-right">Total Net Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-black uppercase tracking-widest">
                        Scanning time period ledger...
                      </td>
                    </tr>
                  ) : rangeSalesData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No sales found for this period.
                      </td>
                    </tr>
                  ) : (
                    rangeSalesData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-900 uppercase tracking-tight">{item.brandName}</td>
                        <td className="px-6 py-4 text-slate-700 font-bold uppercase tracking-tighter">{item.productName}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black tracking-widest uppercase">
                            {item.categoryName || 'Spirit'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-black text-slate-900 text-sm">{item.totalQuantity}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-amber-600">
                          ₹{Number(item.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLOSING SALES & CLOSING STOCK */}
      {activeTab === 'closing-sales' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Period Start</label>
                <input
                  type="date"
                  value={closingStartDate}
                  onChange={e => setClosingStartDate(e.target.value)}
                  className="px-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Period End</label>
                <input
                  type="date"
                  value={closingEndDate}
                  onChange={e => setClosingEndDate(e.target.value)}
                  className="px-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
              <div className="pt-4 flex items-center gap-3">
                <label className="flex items-center gap-3 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 hover:border-amber-200 transition-all">
                  <input
                    type="checkbox"
                    checked={showZeroStock}
                    onChange={e => setShowZeroStock(e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                  />
                  <span className="font-bold uppercase tracking-tight">Full Matrix</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => setShowDryModal(true)}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-black text-slate-700 transition-all cursor-pointer shadow-xs uppercase tracking-widest"
              >
                <Calendar className="w-4 h-4" />
                <span>Mark Dry Day</span>
              </button>
              <button
                onClick={fetchClosingStock}
                disabled={loading}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl border border-transparent shadow-lg shadow-slate-900/10 transition-all cursor-pointer uppercase tracking-widest"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Audit Period</span>
              </button>
            </div>
          </div>

          {/* Dry Days Banner */}
          {dryDays.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Period Sanctions Active</div>
                <div className="text-amber-900 font-bold mt-0.5">
                  {dryDays.map(d => `${d.dry_date} (${d.reason})`).join(' • ')}
                </div>
              </div>
            </div>
          )}

          {/* Closing Stock Matrix Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Identity</th>
                    <th className="px-6 py-4">Volume</th>
                    <th className="px-6 py-4 text-right">Opening</th>
                    <th className="px-6 py-4 text-right text-emerald-600">Inward (+)</th>
                    <th className="px-6 py-4 text-right text-rose-600">Sales (-)</th>
                    <th className="px-6 py-4 text-right font-black text-slate-900 bg-slate-50/30">AUDIT CLOSING</th>
                    <th className="px-6 py-4 text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center font-black uppercase tracking-widest text-slate-200">
                        Running reconciliation audit...
                      </td>
                    </tr>
                  ) : displayedClosingItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No closing stock records calculated for the selected period.
                      </td>
                    </tr>
                  ) : (
                    displayedClosingItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-300">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 uppercase tracking-tight leading-tight">{item.productName}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.productType} • SCM: {item.scmCode || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-bold">{item.volumeMl} ml</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-400">{item.openingStock}</td>
                        <td className="px-6 py-4 text-right font-mono font-black text-emerald-600">+{item.receivedStock}</td>
                        <td className="px-6 py-4 text-right font-mono font-black text-rose-500">-{item.salesStock}</td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 bg-slate-50/30">
                          <span className="text-sm">{item.closingStock}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                          ₹{Number(item.stockValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Dry Day Modal */}
          <ModalShell
            isOpen={showDryModal}
            onClose={() => setShowDryModal(false)}
            title="Declare Dry Day"
            subtitle="Operational Restriction Entry"
            icon={<Calendar className="w-5 h-5" />}
            maxWidth="max-w-md"
            footer={
              <div className="flex justify-end gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowDryModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleAddDryDay}
                  className="px-10 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                >
                  Confirm Declaration
                </button>
              </div>
            }
          >
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">Declare Date *</label>
                <input
                  type="date"
                  value={newDryDate}
                  onChange={e => setNewDryDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">Regulatory Mandate / Reason *</label>
                <input
                  type="text"
                  value={newDryReason}
                  onChange={e => setNewDryReason(e.target.value)}
                  required
                  placeholder="e.g. State Excise Mandated..."
                  className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                />
              </div>
            </div>
          </ModalShell>
        </div>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalBulkEntryModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        module="sales"
        language="en"
        onAddRows={handleAddBulkRows}
      />
    </div>
  );
};
