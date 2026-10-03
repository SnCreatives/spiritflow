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
  Layers,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  Lock,
} from 'lucide-react';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';
import { CanonicalProductSelector, SelectedProductDetail } from '../common/CanonicalProductSelector';

type SubTab = 'add-sale' | 'update-sale' | 'range-sales' | 'closing-sales';

export const SalesTransactionView: React.FC = () => {
  const { selectedBar } = useBar();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<SubTab>('add-sale');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tab 1: Add Sale Form State
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductDetail | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [permitNumber, setPermitNumber] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [remarks, setRemarks] = useState<string>('');

  // Tab 2: Update Sale State
  const [salesList, setSalesList] = useState<any[]>([]);
  const [searchSale, setSearchSale] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
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
    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const payload = {
        barId: selectedBar.id,
        invoiceNumber,
        invoiceDate: saleDate,
        customerName: customerName.trim() || undefined,
        customerPermitNumber: permitNumber.trim() || undefined,
        paymentMethod,
        remarks: remarks.trim() || undefined,
        items: [
          {
            productId: selectedProduct.productId,
            quantity,
            unitPrice,
            taxableValue,
            vatRate,
            vatAmount,
            totalValue: totalAmount,
          },
        ],
      };

      const res = await apiPost('/api/sales', payload);
      if (res.success) {
        showSuccess('Sale saved successfully.');
        // Reset form
        setQuantity(1);
        setCustomerName('');
        setPermitNumber('');
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
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch Sales for Update Tab
  const fetchSalesList = useCallback(async () => {
    if (!selectedBar?.id || selectedBar.id === 'ALL_BARS') return;
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/sales?barId=${encodeURIComponent(selectedBar.id)}&startDate=${filterStartDate}&endDate=${filterEndDate}&search=${encodeURIComponent(searchSale)}&limit=100`
      );
      if (res.success) {
        setSalesList(res.data?.sales || []);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load sales transactions.');
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, filterStartDate, filterEndDate, searchSale, showError]);

  useEffect(() => {
    if (activeTab === 'update-sale' && selectedBar?.id && selectedBar.id !== 'ALL_BARS') {
      fetchSalesList();
    }
  }, [activeTab, selectedBar?.id, fetchSalesList]);

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
        fetchSalesList();
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
        fetchSalesList();
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
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Bar Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <ShoppingCart className="w-4 h-4" />
            Operational Transaction Entry
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Sales & Stock Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Bar:{' '}
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {selectedBar.name}
            </span>
          </p>
        </div>

        {/* Subtab Navigation */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('add-sale')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'add-sale'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Sale
          </button>
          <button
            onClick={() => setActiveTab('update-sale')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'update-sale'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            Update Sale Entry
          </button>
          <button
            onClick={() => setActiveTab('range-sales')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'range-sales'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            Range Sales
          </button>
          <button
            onClick={() => setActiveTab('closing-sales')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'closing-sales'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Closing Sales
          </button>
        </div>
      </div>

      {/* TAB 1: ADD SALE */}
      {activeTab === 'add-sale' && (
        <form onSubmit={handleAddSale} className="space-y-6">
          {/* Step 1: Canonical Product Selector */}
          <CanonicalProductSelector
            onSelectProduct={prod => setSelectedProduct(prod)}
            selectedProductId={selectedProduct?.productId}
          />

          {/* Step 2: Transaction Details Form Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Sale Transaction Parameters</span>
              {checkingStock && (
                <span className="text-xs font-normal text-slate-500 animate-pulse">
                  Checking current stock...
                </span>
              )}
              {availableStock !== null && (
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                    availableStock > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  Available Stock: {availableStock} units
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Sale Date *
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Quantity (Units/Bottles) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={availableStock !== null && availableStock > 0 ? availableStock : 9999}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Unit MRP / Selling Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Unit MRP (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR">UPI / QR</option>
                  <option value="Card">Card</option>
                  <option value="Credit / Ledger">Credit / Ledger</option>
                </select>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="Counter / Customer Name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Permit Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Permit Number (If Applicable)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MH-PERMIT-4091"
                  value={permitNumber}
                  onChange={e => setPermitNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Remarks */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional transaction reference"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Calculations Breakdown Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Taxable Value
                  </span>
                  <span className="text-sm font-bold text-slate-900">₹{taxableValue}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Sales Tax Rate
                  </span>
                  <span className="text-sm font-bold text-slate-900">{vatRate}%</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    VAT Amount
                  </span>
                  <span className="text-sm font-bold text-slate-900">₹{vatAmount}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Total Invoice Amount
                  </span>
                  <span className="text-base font-black text-amber-600">₹{totalAmount}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedProduct}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Record Sale Transaction
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: UPDATE SALE ENTRY */}
      {activeTab === 'update-sale' && (
        <div className="space-y-4">
          {/* Filters Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Search Invoice / Product
                </label>
                <input
                  type="text"
                  placeholder="Invoice number or item"
                  value={searchSale}
                  onChange={e => setSearchSale(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 w-48"
                />
              </div>
            </div>

            <button
              onClick={fetchSalesList}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer / Permit</th>
                    <th className="px-4 py-3">Items Sold</th>
                    <th className="px-4 py-3 text-right">Taxable (₹)</th>
                    <th className="px-4 py-3 text-right">VAT (₹)</th>
                    <th className="px-4 py-3 text-right">Total (₹)</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Loading sales transactions...
                      </td>
                    </tr>
                  ) : salesList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No sales transactions found for this date range in {selectedBar.name}.
                      </td>
                    </tr>
                  ) : (
                    salesList.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {sale.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sale.invoice_date?.split('T')[0]}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 block">
                            {sale.customer_name || 'Counter Customer'}
                          </span>
                          {sale.customer_permit_number && (
                            <span className="text-[10px] text-amber-700 font-mono">
                              Permit: {sale.customer_permit_number}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(sale.items || []).map((item: any, idx: number) => (
                            <div key={idx} className="text-slate-700">
                              <span className="font-medium">
                                {item.product?.name || item.product?.product_name || 'Product'}
                              </span>{' '}
                              <strong className="text-slate-900">x{item.quantity}</strong>
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          ₹{Number(sale.total_taxable_value || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          ₹{Number(sale.total_vat_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          ₹{Number(sale.total_invoice_value || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingSale(sale);
                                setEditQuantity(Number(sale.items?.[0]?.quantity || 1));
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Quantity"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Modal */}
          {editingSale && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase">
                  Update Sale: {editingSale.invoice_number}
                </h3>
                <p className="text-xs text-slate-600">
                  Product: {editingSale.items?.[0]?.product?.name || 'Selected Item'}
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Corrected Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={e => setEditQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Stock ledger will be automatically rebalanced upon update.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingSale(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateSaleSubmit}
                    disabled={submitting}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Update Transaction'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RANGE SALES */}
      {activeTab === 'range-sales' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={rangeStartDate}
                  onChange={e => setRangeStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={rangeEndDate}
                  onChange={e => setRangeEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <button
              onClick={fetchRangeSales}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Calculate Range
            </button>
          </div>

          {/* Range Sales Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Units Sold</th>
                    <th className="px-4 py-3 text-right">Taxable (₹)</th>
                    <th className="px-4 py-3 text-right">VAT (₹)</th>
                    <th className="px-4 py-3 text-right">Total Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Generating range sales summary...
                      </td>
                    </tr>
                  ) : rangeSalesData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No sales recorded for this date range in {selectedBar.name}.
                      </td>
                    </tr>
                  ) : (
                    rangeSalesData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{item.productName}</td>
                        <td className="px-4 py-3 text-slate-600">{item.brandName}</td>
                        <td className="px-4 py-3 text-slate-600">{item.categoryName}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {item.totalQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          ₹{Number(item.totalTaxable || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          ₹{Number(item.totalVat || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-amber-600">
                          ₹{Number(item.totalValue || 0).toFixed(2)}
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
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  From Opening Stock Date
                </label>
                <input
                  type="date"
                  value={closingStartDate}
                  onChange={e => setClosingStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  To Closing Stock Date
                </label>
                <input
                  type="date"
                  value={closingEndDate}
                  onChange={e => setClosingEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="zeroStock"
                  checked={showZeroStock}
                  onChange={e => setShowZeroStock(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="zeroStock" className="text-xs font-bold text-slate-700 select-none">
                  Show Zero Stock Items
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDryModal(true)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                Add Dry Day
              </button>
              <button
                onClick={fetchClosingStock}
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Generate Closing
              </button>
            </div>
          </div>

          {/* Dry Days Notification Banner if any exist in period */}
          {dryDays.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Configured Dry Days:</strong>{' '}
                {dryDays.map(d => `${d.dry_date} (${d.reason})`).join(' • ')}
              </span>
            </div>
          )}

          {/* Closing Stock Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Serial</th>
                    <th className="px-4 py-3">Brand / Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">ML</th>
                    <th className="px-4 py-3">SCM Code</th>
                    <th className="px-4 py-3 text-right">Opening</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                    <th className="px-4 py-3 text-right">Closing</th>
                    <th className="px-4 py-3 text-right">Valuation (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Calculating authoritative backend closing stock...
                      </td>
                    </tr>
                  ) : displayedClosingItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        No closing stock records calculated for the selected period in {selectedBar.name}.
                      </td>
                    </tr>
                  ) : (
                    displayedClosingItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{item.productName}</td>
                        <td className="px-4 py-3 text-slate-600">{item.productType}</td>
                        <td className="px-4 py-3 text-slate-600">{item.volumeMl} ml</td>
                        <td className="px-4 py-3 font-mono text-amber-800 text-[11px]">
                          {item.scmCode || 'Pending'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-700">
                          {item.openingQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-emerald-700">
                          +{item.receivedQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-rose-700">
                          -{item.salesQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                          {item.closingQuantity}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          ₹{Number(item.stockValuation || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Dry Day Modal */}
          {showDryModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleAddDryDay}
                className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  Add Dry Day for {selectedBar.name}
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dry Date *
                  </label>
                  <input
                    type="date"
                    value={newDryDate}
                    onChange={e => setNewDryDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reason / Mandate *
                  </label>
                  <input
                    type="text"
                    value={newDryReason}
                    onChange={e => setNewDryReason(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDryModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Add Dry Day
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
