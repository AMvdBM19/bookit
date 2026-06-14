'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenantConfig } from '@/lib/context/tenant-config';
import ThemeToggle from '@/app/components/theme-toggle';
import OnboardingChecklist from '@/components/onboarding-checklist';
import BookingsSection from './sections/bookings-section';
import AnalyticsSection from './sections/analytics-section';
import StaffSection from './sections/staff-section';
import ClientsSection from './sections/clients-section';
import PricingSection from './sections/pricing-section';
import SettingsSection from './sections/settings-section';
import TemplatesSection from './sections/templates-section';
import WidgetSection from './sections/widget-section';

type Tab = 'bookings' | 'analytics' | 'staff' | 'clients' | 'pricing' | 'widget' | 'templates' | 'settings';

interface Props {
  slug: string;
  tenantName: string;
  agentEmail: string;
  clientMode: 'guest' | 'account';
  wizardCompleted?: boolean;
}

const TAB_IDS: Tab[] = ['bookings', 'analytics', 'staff', 'clients', 'pricing', 'widget', 'templates', 'settings'];

function TabIcon({ id }: { id: Tab }) {
  const p = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'bookings':
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...p}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'staff':
      return (
        <svg {...p}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'clients':
      return (
        <svg {...p}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'pricing':
      return (
        <svg {...p}>
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'widget':
      return (
        <svg {...p}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M2 7h20M8 21h8M12 17v4" />
        </svg>
      );
    case 'templates':
      return (
        <svg {...p}>
          <path d="M4 4h16v4H4zM4 12h10v8H4zM18 12h2v8h-2z" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}

export default function AgentDashboard({
  slug,
  tenantName,
  agentEmail,
  clientMode,
  wizardCompleted = false,
}: Props) {
  const { terminology } = useTenantConfig();
  const [tab, setTab] = useState<Tab>('bookings');
  const [navOpen, setNavOpen] = useState(false);

  // Tab/header labels follow the tenant's configured terminology; Templates and
  // Settings are system concepts and stay fixed.
  function labelFor(id: Tab): string {
    switch (id) {
      case 'bookings':
        return terminology.booking_plural;
      case 'analytics':
        return 'Analytics';
      case 'staff':
        return terminology.staff_plural;
      case 'clients':
        return terminology.client_plural;
      case 'pricing':
        return 'Pricing';
      case 'widget':
        return 'Widget';
      case 'templates':
        return 'Templates';
      case 'settings':
        return 'Settings';
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `/${slug}/login`;
  }

  function selectTab(id: Tab) {
    setTab(id);
    setNavOpen(false);
  }

  const nav = (
    <>
      <div className="px-5 py-5 border-b border-sidebar-border">
        <p className="text-sm font-semibold text-sidebar-fg truncate">{tenantName}</p>
        <p className="text-[11px] text-sidebar-muted mt-0.5 truncate">{agentEmail}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {TAB_IDS.map(id => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 text-left px-3 py-2 text-sm rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'bg-sidebar-active text-sidebar-fg'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg'
              }`}
            >
              <TabIcon id={id} />
              <span className="truncate">{labelFor(id)}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-sidebar-border flex items-center gap-1">
        <button
          type="button"
          onClick={signOut}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
        <ThemeToggle variant="sidebar" />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas text-fg flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-sidebar flex-col shrink-0">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar flex flex-col shadow-xl">
            {nav}
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-border px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden -ml-1 p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-fg truncate">{labelFor(tab)}</h1>
          <div className="ml-auto lg:hidden">
            <ThemeToggle variant="surface" />
          </div>
        </header>

        <div className="p-4 sm:p-6 flex-1">
          {wizardCompleted && (
            <OnboardingChecklist slug={slug} onNavigate={id => selectTab(id)} />
          )}
          {tab === 'bookings' && <BookingsSection slug={slug} />}
          {tab === 'analytics' && <AnalyticsSection slug={slug} />}
          {tab === 'staff' && <StaffSection slug={slug} />}
          {tab === 'clients' && <ClientsSection slug={slug} clientMode={clientMode} />}
          {tab === 'pricing' && <PricingSection slug={slug} />}
          {tab === 'widget' && <WidgetSection slug={slug} />}
          {tab === 'templates' && <TemplatesSection slug={slug} />}
          {tab === 'settings' && <SettingsSection slug={slug} />}
        </div>
      </main>
    </div>
  );
}
