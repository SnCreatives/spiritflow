import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  ShieldCheck,
  Plus,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Building,
  FileText,
  X,
  CheckCircle2,
} from 'lucide-react';
import { SupportedLanguage, ExciseLicence, ExciseDocumentReference } from '../../types';
import { apiGet, apiPost } from '../../utils/api';
import { translations } from '../../utils/i18n';
import { MonthlyReturnView } from './MonthlyReturnView';

interface ExciseViewProps {
  language: SupportedLanguage;
}

export const ExciseView: React.FC<ExciseViewProps> = ({ language }) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'licences' | 'documents' | 'monthly_return'>('licences');
  const [licences, setLicences] = useState<ExciseLicence[]>([]);
  const [documents, setDocuments] = useState<ExciseDocumentReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showAddLicence, setShowAddLicence] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Forms
  const [licenceForm, setLicenceForm] = useState({
    licenceType: 'FL-II (Retail Off)',
    licenceNumber: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    issuingAuthority: 'State Excise Commissioner',
    businessReference: '',
    remarks: '',
  });

  const [docForm, setDocForm] = useState({
    referenceType: 'TP_PERMIT' as 'TP_PERMIT' | 'TRANSPORT' | 'INWARD' | 'LICENCE' | 'EXCISE_DOCUMENT' | 'OTHER',
    referenceNumber: '',
    referenceDate: new Date().toISOString().split('T')[0],
    quantity: 100,
    documentReference: '',
    remarks: '',
  });

  const fetchExciseData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lData, dData] = await Promise.all([
        apiGet('/api/excise/licences'),
        apiGet('/api/excise/documents'),
      ]);

      if (lData.success) setLicences(lData.data?.licences || []);
      if (dData.success) setDocuments(dData.data?.documents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExciseData();
  }, []);

  const handleCreateLicence = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiPost('/api/excise/licences', licenceForm);
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create licence');
      }
      setFeedback('Excise Licence recorded successfully!');
      setShowAddLicence(false);
      fetchExciseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiPost('/api/excise/documents', docForm);
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to record excise document');
      }
      setFeedback('Excise Document Reference recorded successfully!');
      setShowAddDoc(false);
      fetchExciseData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <span>Excise & Compliance Reference Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Excise Licences, TP Transport Permits, and Statutory Document Verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'licences' ? (
            <button
              type="button"
              onClick={() => setShowAddLicence(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Licence</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddDoc(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Document Ref</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchExciseData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('licences')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'licences' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Excise Licences ({licences.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'documents' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Document & TP References ({documents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('monthly_return')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'monthly_return' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Monthly Foreign Liquor Return
        </button>
      </div>

      {activeTab === 'monthly_return' && <MonthlyReturnView language={language} />}

      {/* Licences List */}
      {activeTab === 'licences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {licences.length > 0 ? (
            licences.map(lic => (
              <div key={lic.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {lic.licence_type}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lic.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {lic.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white font-mono">{lic.licence_number}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    <span>{lic.issuing_authority}</span>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Valid From:</span>
                    <span className="text-slate-200">{lic.valid_from}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Valid To:</span>
                    <span className="text-amber-400 font-semibold">{lic.valid_to}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              No excise licences registered yet. Click "Add Licence" to create your first statutory licence.
            </div>
          )}
        </div>
      )}

      {/* Documents List */}
      {activeTab === 'documents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="table-container">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Reference Number</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                  <th className="py-3 px-4 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {documents.length > 0 ? (
                  documents.map((doc, idx) => (
                    <tr key={doc.id || idx} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {doc.reference_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-white">
                        {doc.reference_number}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{doc.reference_date}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {(doc.product as any)?.product_name || (doc.product as any)?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-200">
                        {doc.quantity || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{doc.remarks || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No excise document references recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Licence Modal */}
      {showAddLicence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleCreateLicence} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span>Add Excise Licence</span>
              </h3>
              <button type="button" onClick={() => setShowAddLicence(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Licence Type *</label>
                <input
                  required
                  type="text"
                  value={licenceForm.licenceType}
                  onChange={e => setLicenceForm({ ...licenceForm, licenceType: e.target.value })}
                  placeholder="e.g. FL-II, CL-III, BW-I"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Licence Number *</label>
                <input
                  required
                  type="text"
                  value={licenceForm.licenceNumber}
                  onChange={e => setLicenceForm({ ...licenceForm, licenceNumber: e.target.value })}
                  placeholder="e.g. EX-MH-2026-489"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Valid From *</label>
                  <input
                    required
                    type="date"
                    value={licenceForm.validFrom}
                    onChange={e => setLicenceForm({ ...licenceForm, validFrom: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Valid To *</label>
                  <input
                    required
                    type="date"
                    value={licenceForm.validTo}
                    onChange={e => setLicenceForm({ ...licenceForm, validTo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Issuing Authority *</label>
                <input
                  required
                  type="text"
                  value={licenceForm.issuingAuthority}
                  onChange={e => setLicenceForm({ ...licenceForm, issuingAuthority: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddLicence(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                {submitting ? 'Saving...' : 'Save Licence'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Document Ref Modal */}
      {showAddDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleCreateDoc} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <span>Record Document / TP Reference</span>
              </h3>
              <button type="button" onClick={() => setShowAddDoc(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Reference Type *</label>
                <select
                  value={docForm.referenceType}
                  onChange={e => setDocForm({ ...docForm, referenceType: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="TP_PERMIT">TP Permit (Transport Permit)</option>
                  <option value="TRANSPORT">Transport Document</option>
                  <option value="INWARD">Inward Verification Note</option>
                  <option value="LICENCE">Excise Licence Reference</option>
                  <option value="EXCISE_DOCUMENT">Statutory Excise Form</option>
                  <option value="OTHER">Other Reference</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reference Number *</label>
                <input
                  required
                  type="text"
                  value={docForm.referenceNumber}
                  onChange={e => setDocForm({ ...docForm, referenceNumber: e.target.value })}
                  placeholder="TP-9923-A"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantity (Units)</label>
                <input
                  type="number"
                  value={docForm.quantity}
                  onChange={e => setDocForm({ ...docForm, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Remarks</label>
                <input
                  type="text"
                  value={docForm.remarks}
                  onChange={e => setDocForm({ ...docForm, remarks: e.target.value })}
                  placeholder="Batch or route details"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddDoc(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors"
              >
                {submitting ? 'Recording...' : 'Record Document'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
