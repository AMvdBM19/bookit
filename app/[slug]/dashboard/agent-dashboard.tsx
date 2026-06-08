'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenantConfig } from '@/lib/context/tenant-config';
import BookingsSection from './sections/bookings-section';
import StaffSection from './sections/staff-section';
import ClientsSection from './sections/clients-section';
import PricingSection from './sections/pricing-section';
import SettingsSection from './sections/settings-section';
import TemplatesSection from './sections/templates-section';

type Tab = 'bookings' | 'staff' | 'clients' | 'pricing' | 'templates' | 'settings';

interface Props {
  slug: string;
  tenantName: string;
  agentEmail: string;
  clientMode: 'guest' | 'account';
}

const TAB_IDS: Tab[] = ['bookings', 'staff', 'clients', 'pricing', 'templates', 'settings'];

export default function AgentDashboard({
  slug,
  tenantName,
  agentEmail,
  clientMode,
}: Props) {
  const { terminology } = useTenantConfig();
  const [tab, setTab] = useState<Tab>('bookings');

  // Tab/header labels follow the tenant's configured terminology; Templates and
  // Settings are system concepts and stay fixed.
  function labelFor(id: Tab): string {
    switch (id) {
      case 'bookings':
        return terminology.booking_plural;
      case 'staff':
        return terminology.staff_plural;
      case 'clients':
        return terminology.client_plural;
      case 'pricing':
        return 'Pricing';
      case 'templates':
        return 'Templates';
      case 'settings':
        return 'Settings';
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-sm font-semibold text-white truncate">{tenantName}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{agentEmail}</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {TAB_IDS.map(id => {
            const active = tab === id;
            const label = labelFor(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-slate-800">
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = `/${slug}/login`;
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white rounded transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-zinc-200 px-6 py-4">
          <h1 className="text-base font-semibold text-zinc-900">
            {labelFor(tab)}
          </h1>
        </header>

        <div className="p-6">
          {tab === 'bookings' && <BookingsSection slug={slug} />}
          {tab === 'staff' && <StaffSection slug={slug} />}
          {tab === 'clients' && <ClientsSection slug={slug} clientMode={clientMode} />}
          {tab === 'pricing' && <PricingSection slug={slug} />}
          {tab === 'templates' && <TemplatesSection slug={slug} />}
          {tab === 'settings' && <SettingsSection slug={slug} />}
        </div>
      </main>
    </div>
  );
}
