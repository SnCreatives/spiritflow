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
    <div className="space-y-6 font-sans">
      {/* 2. SIMPLE PAGE STRUCTURE: Page Title, Short description, Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bar Outlets & Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure multi-bar locations, license details, contact persons, and active bar switching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bar Outlet</span>
          </button>
          <button
            type="button"
            onClick={() => refreshBars()}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-md transition-colors cursor-pointer"
            title="Refresh Outlets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-lg">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by bar name, code, city, license..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filteredBars.length} {filteredBars.length === 1 ? 'outlet' : 'outlets'} found
        </span>
      </div>

      {/* Main Table for Business Records */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Bar Outlet</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">City / Location</th>
                <th className="px-4 py-2.5">License Ref</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading bar outlets...
                  </td>
                </tr>
              ) : filteredBars.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No bar outlets found. Click "+ Add Bar Outlet" to register your first bar.
                  </td>
                </tr>
              ) : (
                filteredBars.map(bar => {
                  const isSelected = selectedBar?.id === bar.id;
                  return (
                    <tr key={bar.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{bar.name}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        {bar.address && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{bar.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{bar.code || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{bar.city || 'Maharashtra'}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-800">{bar.license_number || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {bar.contact_person ? <span>{bar.contact_person}</span> : '—'}
                        {bar.phone && <div className="text-[11px] font-mono text-slate-400">{bar.phone}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            bar.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {bar.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1.5">
                        {!isSelected ? (
                          <button
                            type="button"
                            onClick={() => setSelectedBar(bar)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Switch to Bar
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-semibold px-2 py-1">Active</span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(bar)}
                          className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          title="Edit Bar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(bar)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                        >
                          {bar.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBar(bar)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Delete Bar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <ModalShell
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingBar ? 'Edit Bar Outlet' : 'Register New Bar Outlet'}
        icon={<Store className="w-5 h-5 text-amber-600" />}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition-colors font-medium text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              form="bar-form"
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md shadow-xs transition-all disabled:opacity-50 cursor-pointer text-xs"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="bar-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className="text-slate-700 font-semibold block mb-1">
              Bar Outlet Name *
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Main Bar / Rooftop Lounge"
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Excise Licence Reference</label>
              <input
                type="text"
                value={formData.license_number}
                onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                placeholder="e.g. FL-II / CL-III 2026"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Mumbai / Pune"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Manager / Owner name"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              />
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-700 font-semibold block mb-1">Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address, locality..."
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs resize-none"
            />
          </div>
        </form>
      </ModalShell>

      {/* Safe Delete Confirmation Modal */}
      <ModalShell
        isOpen={!!deletingBar}
        onClose={() => setDeletingBar(null)}
        title="Delete Bar Outlet"
        icon={<Trash2 className="w-5 h-5 text-rose-500" />}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeletingBar(null)}
              disabled={deleting}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteBar}
              disabled={deleting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {deleting ? 'Processing...' : 'Confirm Delete / Deactivate'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <p className="font-bold text-slate-900">{deletingBar?.name}</p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Code: {deletingBar?.code || 'N/A'}</p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md space-y-2 text-slate-700">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold uppercase text-[10px]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Safe Deletion Rule</span>
            </div>
            <p>
              If this outlet has no transactional records, it will be deleted. If historical records exist, it will be deactivated to protect compliance logs.
            </p>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};
