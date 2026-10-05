import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Plus, RefreshCw, AlertCircle, CheckCircle2, X, Store, Package } from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';
import { useBar } from '../../lib/contexts/BarContext';
import { useToast } from '../../lib/contexts/ToastContext';
import { ProductPackSizeSelector } from '../common/ProductPackSizeSelector';

export const StockTransfersView: React.FC = () => {
  const { selectedBar, availableBars } = useBar();
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    transferNumber: `TRF-${Date.now().toString().slice(-6)}`,
    transferDate: new Date().toISOString().split('T')[0],
    destinationBarId: '',
    productId: '',
    quantity: 1,
    remarks: ''
  });

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      // For now we use stock ledger or a dedicated endpoint if created
      // Let's assume we want to see transfers involving the selected bar
      const data = await apiGet(`/api/inventory/ledger?limit=100`);
      if (data.success) {
        setTransfers(data.data.ledger.filter((l: any) => 
          l.transaction_type.includes('ADJUSTMENT') && l.remarks.includes('Transfer')
        ));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const data = await apiGet('/api/products/selection');
    if (data.success) {
      setProducts(data.data.items);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchProducts();
  }, [selectedBar?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBar) return;
    
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiPost('/api/inventory/transfers', {
        transferNumber: formData.transferNumber,
        transferDate: formData.transferDate,
        sourceBarId: selectedBar.id,
        destinationBarId: formData.destinationBarId,
        remarks: formData.remarks,
        items: [{
          productId: formData.productId,
          quantity: Number(formData.quantity)
        }]
      });

      if (res.success) {
        showToast('Stock transfer completed successfully', 'success');
        setShowModal(false);
        fetchTransfers();
      } else {
        throw new Error(res.error?.message || 'Transfer failed');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowUpRight className="w-6 h-6 text-amber-400" />
            <span>Stock Transfers</span>
            {selectedBar && (
              <span className="ml-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm font-medium">
                {selectedBar.name}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Move stock between authorized bars. Source bar stock will decrease, destination will increase.
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setFormData(prev => ({
              ...prev,
              transferNumber: `TRF-${Date.now().toString().slice(-6)}`,
              destinationBarId: availableBars.find(b => b.id !== selectedBar?.id)?.id || ''
            }));
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Transfer</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Recent Transfer Movements</h2>
          <button onClick={fetchTransfers} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Reference</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Direction</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transfers.length > 0 ? (
                transfers.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-slate-300">
                      {new Date(tx.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-200">{tx.reference_number}</td>
                    <td className="px-6 py-4 font-medium text-white">
                      {tx.product?.product_name || tx.product?.name}
                    </td>
                    <td className="px-6 py-4">
                      {tx.stock_out > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Outward
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Inward
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-200">
                      {tx.stock_in || tx.stock_out}
                    </td>
                    <td className="px-6 py-4 text-slate-400 italic text-[11px]">{tx.remarks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {loading ? 'Loading transfers...' : 'No transfer records found for this bar.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-500" />
                <span>New Stock Transfer</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transfer #</label>
                  <input
                    required
                    type="text"
                    value={formData.transferNumber}
                    onChange={e => setFormData({ ...formData, transferNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
                  <input
                    required
                    type="date"
                    value={formData.transferDate}
                    onChange={e => setFormData({ ...formData, transferDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Destination Bar</label>
                <select
                  required
                  value={formData.destinationBarId}
                  onChange={e => setFormData({ ...formData, destinationBarId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">Select Destination Bar</option>
                  {availableBars.filter(b => b.id !== selectedBar?.id).map(bar => (
                    <option key={bar.id} value={bar.id}>{bar.name} ({bar.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <ProductPackSizeSelector
                  value={formData.productId}
                  onChange={pid => setFormData({ ...formData, productId: pid })}
                  required
                  label="Select Product"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quantity to Transfer</label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  placeholder="Reason for transfer..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !formData.destinationBarId || !formData.productId}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Execute Transfer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
