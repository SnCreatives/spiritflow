import React, { useState } from 'react';
import {
  Store,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  MapPin,
  FileText,
  User,
  Trash2,
} from 'lucide-react';
import { BarOutlet, SupportedLanguage } from '../../types';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { useBar } from '../../lib/contexts/BarContext';

interface BarMasterViewProps {
  language: SupportedLanguage;
}

export const BarMasterView: React.FC<BarMasterViewProps> = ({ language }) => {
  const t = translations[language];
  const { selectedBar, setSelectedBar, availableBars, isLoading: loading, refreshBars } = useBar();
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBar, setEditingBar] = useState<BarOutlet | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [deletingBar, setDeletingBar] = useState<BarOutlet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteBar = async () => {
    if (!deletingBar) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const res = await apiDelete(`/api/bars/${deletingBar.id}`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to delete bar outlet');
      }
      setFeedback({
        type: res.data?.action === 'deactivated' ? 'error' : 'success',
        message: res.data?.message || `Bar outlet "${deletingBar.name}" processed successfully.`,
      });
      setDeletingBar(null);
      await refreshBars();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      setDeletingBar(null);
    } finally {
      setDeleting(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '',
    contact_person: '',
    phone: '',
    email: '',
    license_number: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const openCreateModal = () => {
    setEditingBar(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '',
      contact_person: '',
      phone: '',
      email: '',
      license_number: '',
      status: 'Active',
    });
    setShowModal(true);
  };

  const openEditModal = (bar: BarOutlet) => {
    setEditingBar(bar);
    setFormData({
      name: bar.name,
      code: bar.code,
      address: bar.address || '',
      city: bar.city || 'Mumbai',
      state: bar.state || 'Maharashtra',
      pincode: bar.pincode || '',
      contact_person: bar.contact_person || '',
      phone: bar.phone || '',
      email: bar.email || '',
      license_number: bar.license_number || '',
      status: bar.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFeedback({ type: 'error', message: 'Bar name and code are required.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (editingBar) {
        const res = await apiPut(`/api/bars/${editingBar.id}`, formData);
        if (!res.success) throw new Error(res.error?.message || 'Failed to update bar');
        setFeedback({ type: 'success', message: `Bar outlet "${formData.name}" updated successfully!` });
        await refreshBars();
        if (selectedBar?.id === editingBar.id && res.data) {
          setSelectedBar(res.data);
        }
      } else {
        const res = await apiPost('/api/bars', formData);
        if (!res.success) throw new Error(res.error?.message || 'Failed to create bar');
        setFeedback({ type: 'success', message: `Bar outlet "${formData.name}" created successfully!` });
        await refreshBars();
        if (res.data) {
          setSelectedBar(res.data);
        }
      }
      setShowModal(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (bar: BarOutlet) => {
    const newStatus = bar.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await apiPatch(`/api/bars/${bar.id}/status`, { status: newStatus });
      if (!res.success) throw new Error(res.error?.message || 'Failed to toggle status');
      setFeedback({ type: 'success', message: `Bar "${bar.name}" marked as ${newStatus}.` });
      await refreshBars();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const filteredBars = availableBars.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      (b.city && b.city.toLowerCase().includes(q)) ||
      (b.license_number && b.license_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Store className="w-6 h-6 text-amber-400" />
            <span>Outlets & Bars Master</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage multi-bar locations, license details, contact persons, and outlet-level access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Bar Outlet</span>
          </button>
          <button
            type="button"
            onClick={() => refreshBars()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh Outlets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by bar name, code, city, license..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {filteredBars.length} {filteredBars.length === 1 ? 'outlet' : 'outlets'} found
        </span>
      </div>

      {/* Outlets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBars.map(bar => {
          const isSelected = selectedBar?.id === bar.id;
          return (
            <div
              key={bar.id}
              className={`bg-slate-900 border rounded-2xl p-5 space-y-4 transition-all shadow-sm relative ${
                isSelected
                  ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{bar.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {bar.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{bar.city || 'Maharashtra'}{bar.state ? `, ${bar.state}` : ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      bar.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {bar.status}
                  </span>
                </div>
              </div>

              {/* Outlet Details */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                {bar.license_number && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> License
                    </span>
                    <span className="font-mono text-amber-300">{bar.license_number}</span>
                  </div>
                )}
                {bar.contact_person && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3" /> Contact
                    </span>
                    <span>{bar.contact_person}</span>
                  </div>
                )}
                {bar.phone && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </span>
                    <span className="font-mono">{bar.phone}</span>
                  </div>
                )}
                {bar.address && (
                  <p className="text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5 truncate">
                    {bar.address}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedBar(bar)}
                  disabled={isSelected}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {isSelected ? '✓ Current Active Bar' : 'Switch to This Bar'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(bar)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Edit Bar Outlet"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(bar)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                      bar.status === 'Active'
                        ? 'border-rose-900/40 text-rose-400 hover:bg-rose-950/30'
                        : 'border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/30'
                    }`}
                  >
                    {bar.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingBar(bar)}
                    className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 hover:border-rose-700 rounded-lg transition-colors cursor-pointer"
                    title="Delete Bar Outlet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredBars.length === 0 && (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            {loading ? 'Loading bar outlets...' : 'No bar outlets found. Click "Add New Bar Outlet" to register your first bar.'}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-400" />
                <span>{editingBar ? 'Edit Bar Outlet' : 'Register New Bar Outlet'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">
                    Bar Outlet Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Main Bar / Rooftop Lounge"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">
                    Unique Code <span className="text-amber-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. MAIN / ROOF"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Excise Licence Reference</label>
                  <input
                    type="text"
                    value={formData.license_number}
                    onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder="e.g. FL-II / CL-III 2026"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mumbai / Pune"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Manager / Owner name"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address, locality..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingBar ? 'Update Bar' : 'Create Bar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deletingBar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Bar Outlet</h3>
                <p className="text-xs text-slate-400 font-mono">{deletingBar.name} ({deletingBar.code})</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Safe Deletion Rule:</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>If this outlet has <strong>no transactional records</strong>, it will be permanently deleted.</li>
                <li>If it contains <strong>historical transactions</strong> (inventory, purchases, sales, or stock ledger), it will be <strong>deactivated</strong> to protect compliance and audit records.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBar(null)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteBar}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? 'Processing...' : 'Confirm Delete / Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
