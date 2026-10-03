import React from 'react';
import { User, Shield, Key, Store, CheckCircle2, Lock } from 'lucide-react';
import { AuthUser } from '../../types';
import { useBar } from '../../lib/contexts/BarContext';

interface UserSettingsViewProps {
  user: AuthUser | null;
}

export const UserSettingsView: React.FC<UserSettingsViewProps> = ({ user }) => {
  const { selectedBar } = useBar();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="h-7 w-7 text-amber-600" />
            User Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Account details, role permissions, and active session context for LiquorFlow ERP.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" /> User Profile Summary
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">User ID</span>
              <span className="font-mono text-slate-800">{user?.id || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Email Address</span>
              <span className="font-semibold text-slate-900">{user?.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Assigned Role</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-semibold uppercase">
                {user?.role || 'Bar Manager'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Interface Language</span>
              <span className="text-slate-800 font-medium">English (Fixed)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Store className="h-5 w-5 text-amber-600" /> Active Session & Security
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Active Bar</span>
              <span className="font-semibold text-amber-700">{selectedBar ? selectedBar.name : 'No Bar Selected'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Bar ID</span>
              <span className="font-mono text-xs text-slate-700">{selectedBar ? selectedBar.id : 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Multi-Bar Isolation</span>
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Enforced
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Session Status</span>
              <span className="text-slate-800 font-medium">Active & Authenticated</span>
            </div>
          </div>

          <div className="pt-2 bg-slate-50 p-3 rounded-md border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Lock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <span>
              LiquorFlow enforces server-authoritative bar access control. All requests are strictly bound to your authorized bar context.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
