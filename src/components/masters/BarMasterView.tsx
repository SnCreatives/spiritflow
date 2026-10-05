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
import { useToast } from '../../lib/contexts/ToastContext';
import { useFormMutation } from '../../hooks/useFormMutation';
import { ModalShell } from '../common/ModalShell';

interface BarMasterViewProps {
  language: SupportedLanguage;
}

export const BarMasterView: React.FC<BarMasterViewProps> = ({ language }) => {
  const t = translations[language];
  const { showToast } = useToast();
  const { selectedBar, setSelectedBar, availableBars, isLoading: loading, refreshBars } = useBar();
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBar, setEditingBar] = useState<BarOutlet | null>(null);

  // Delete Modal State
  const [deletingBar, setDeletingBar] = useState<BarOutlet | null>(null);

  const { mutate: deleteBar, isSaving: deleting } = useFormMutation<any, BarOutlet>(
    async (bar) => apiDelete(`/api/bars/${bar.id}`),
    {
      successMessage: (data, bar) => data?.message || `Bar outlet "${bar.name}" processed successfully.`,
      onSuccess: () => setDeletingBar(null),
      invalidateQueries: refreshBars,
    }
  );

  const confirmDeleteBar = async () => {
    if (!deletingBar) return;
    deleteBar(deletingBar);
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
      code: bar.code || '',
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

  const { mutate: submitBar, isSaving: submitting } = useFormMutation(
    async (payload: any) => {
      if (editingBar) {
        return apiPut(`/api/bars/${editingBar.id}`, payload);
      } else {
        return apiPost('/api/bars', payload);
      }
    },
    {
      successMessage: () => `Bar outlet "${formData.name}" ${editingBar ? 'updated' : 'created'} successfully!`,
      onSuccess: (data) => {
        if (data) {
          setSelectedBar(data);
        }
        setShowModal(false);
      },
      invalidateQueries: refreshBars,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Bar name is required.', 'error');
      return;
    }

    submitBar(formData);
  };

  const handleToggleStatus = async (bar: BarOutlet) => {
    const newStatus = bar.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await apiPatch(`/api/bars/${bar.id}/status`, { status: newStatus });
      if (!res.success) throw new Error(res.error?.message || 'Failed to toggle status');
      showToast(`Bar "${bar.name}" marked as ${newStatus}.`, 'success');
      await refreshBars();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredBars = availableBars.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.code && b.code.toLowerCase().includes(q)) ||
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
      <ModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingBar ? 'Edit Bar Outlet' : 'Register New Bar Outlet'}
        icon={<Store className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-medium text-xs"
            >
              Cancel
            </button>
            <button
              form="bar-form"
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingBar ? 'Update Bar' : 'Create Bar'}</span>
              )}
            </button>
          </div>
        }
      >
        <form id="bar-form" onSubmit={handleSubmit} className="space-y-6 text-xs">
          <div className="space-y-2">
            <label className="text-slate-300 font-semibold block">
              Bar Outlet Name <span className="text-amber-400">*</span>
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Main Bar / Rooftop Lounge"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm"
            />
            {!editingBar ? (
              <p className="text-[10px] text-amber-400/80 font-medium italic">
                ✓ Canonical Bar ID will be automatically generated. Owner authorization is auto-provisioned.
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 font-mono">
                Bar ID: {editingBar.id}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold block">Excise Licence Reference</label>
              <input
                type="text"
                value={formData.license_number}
                onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                placeholder="e.g. FL-II / CL-III 2026"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 font-semibold block">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Mumbai / Pune"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold block">Contact Person</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Manager / Owner name"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 font-semibold block">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-slate-300 font-semibold block">Address</label>
            <textarea
              rows={3}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address, locality..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all text-sm resize-none"
            />
          </div>
        </form>
      </ModalShell>

      {/* Safe Delete Confirmation Modal */}
      <ModalShell
        isOpen={!!deletingBar}
        onClose={() => setDeletingBar(null)}
        title="Delete Bar Outlet"
        icon={<Trash2 className="w-5 h-5 text-rose-400" />}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-3">
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
              className="px-6 py-2 bg-rose-600 hover:bg-rose-50 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Confirm Delete / Deactivate</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{deletingBar?.name}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Code: {deletingBar?.code || 'N/A'}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              <span>Safe Deletion Rule</span>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span>If this outlet has <strong>no transactional records</strong>, it will be permanently deleted.</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                <span>If it contains <strong>historical transactions</strong> (inventory, purchases, etc.), it will be <strong>deactivated</strong> to protect compliance records.</span>
              </li>
            </ul>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};
