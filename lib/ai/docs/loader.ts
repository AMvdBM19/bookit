import { promises as fs } from 'fs';
import path from 'path';

/** Agent dashboard tabs, as used in agent-dashboard.tsx. */
export type DashboardTab =
  | 'bookings'
  | 'analytics'
  | 'staff'
  | 'clients'
  | 'pricing'
  | 'widget'
  | 'templates'
  | 'settings';

const ALWAYS_LOADED = ['platform-overview.md', 'tools-reference.md'];

/** Which ai-docs guides are relevant on each dashboard tab. */
export const PAGE_DOC_MAP: Record<DashboardTab, string[]> = {
  bookings: ['booking-guide.md', 'data-export-guide.md'],
  analytics: ['analytics-guide.md'],
  staff: ['staff-guide.md', 'data-export-guide.md'],
  clients: ['client-guide.md', 'data-export-guide.md'],
  pricing: ['pricing-guide.md'],
  widget: ['widget-guide.md', 'booking-guide.md'],
  templates: ['notifications-guide.md'],
  settings: ['settings-guide.md', 'notifications-guide.md'],
};

const DOCS_DIR = path.join(process.cwd(), 'ai-docs');

export interface LoadedDoc {
  file: string;
  content: string;
}

async function readDoc(file: string): Promise<LoadedDoc | null> {
  try {
    const content = await fs.readFile(path.join(DOCS_DIR, file), 'utf-8');
    return { file, content };
  } catch {
    // A missing guide degrades the context, it must not break the request.
    console.error(`[ai:docs] Missing or unreadable doc: ${file}`);
    return null;
  }
}

/**
 * Load the knowledge-base docs for a dashboard tab: the always-on docs
 * (platform overview + tools reference) plus the tab-specific guides.
 * Unknown tabs fall back to the always-on docs only.
 */
export async function loadDocsForTab(tab: string): Promise<LoadedDoc[]> {
  const tabDocs = PAGE_DOC_MAP[tab as DashboardTab] ?? [];
  const files = [...ALWAYS_LOADED, ...tabDocs.filter(f => !ALWAYS_LOADED.includes(f))];
  const loaded = await Promise.all(files.map(readDoc));
  return loaded.filter((d): d is LoadedDoc => d !== null);
}
