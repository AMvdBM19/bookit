'use client';

// React context + hook for widget translations. Split out from
// lib/widget-i18n.ts so the pure helpers (isWidgetLanguage, getWidgetStrings,
// formatWidgetMoney, types) stay importable by the widget page Server
// Component without 'use client' turning them into client references.

import { createContext, useContext } from 'react';
import { getWidgetStrings, type WidgetLanguage, type WidgetStrings } from './widget-i18n';

const WidgetI18nContext = createContext<WidgetStrings>(getWidgetStrings('en'));

export function WidgetI18nProvider({
  lang,
  children,
}: {
  lang: WidgetLanguage;
  children: React.ReactNode;
}) {
  return (
    <WidgetI18nContext.Provider value={getWidgetStrings(lang)}>
      {children}
    </WidgetI18nContext.Provider>
  );
}

export function useWidgetStrings(): WidgetStrings {
  return useContext(WidgetI18nContext);
}
