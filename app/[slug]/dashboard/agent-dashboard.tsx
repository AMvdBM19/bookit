'use client';

import { useState } from 'react';
import BookingsSection from './sections/bookings-section';
import StaffSection from './sections/staff-section';
import ClientsSection from './sections/clients-section';
import SettingsSection from './sections/settings-section';
import TemplatesSection from './sections/templates-section';

type Tab = 'bookings' | 'staff' | 'clients' | 'templates' | 'settings';

interface Props {
  slug: string;
  tenantName: string;
  agentEmail: string;
  clientMode: 'guest' | 'account';
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'staff', label: 'Staff' },
  { id: 'clients', label: 'Clients' },
  { id: 'templates', label: 'Templates' },
  { id: 'settings', label: 'Settings' },
];

export default function AgentDashboard({
  slug,
  tenantName,
  agentEmail,
  clientMode,
}: Props) {
  const [tab, setTab] = useState<Tab>('bookings');

  const clientsLabel = clientMode === 'guest' ? 'Guests' : 'Clients';

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-sm font-semibold text-white truncate">{tenantName}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{agentEmail}</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {TABS.map(t => {
            const active = tab === t.id;
            const label = t.id === 'clients' ? clientsLabel : t.label;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
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
          <a
            href={`/${slug}/logout`}
            className="block px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white rounded transition-colors"
          >
            Sign out
          </a>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-zinc-200 px-6 py-4">
          <h1 className="text-base font-semibold text-zinc-900">
            {tab === 'clients' ? clientsLabel : TABS.find(t => t.id === tab)?.label}
          </h1>
        </header>

        <div className="p-6">
          {tab === 'bookings' && <BookingsSection slug={slug} />}
          {tab === 'staff' && <StaffSection slug={slug} />}
          {tab === 'clients' && <ClientsSection slug={slug} clientMode={clientMode} />}
          {tab === 'templates' && <TemplatesSection slug={slug} />}
          {tab === 'settings' && <SettingsSection slug={slug} />}
        </div>
      </main>
    </div>
  );
}
