import { notFound } from 'next/navigation';
import { loadCatalog } from './catalog-loader';
import { isWidgetLanguage, type WidgetLanguage } from '@/lib/widget-i18n';
import BookingWidget from './booking-widget';

export const dynamic = 'force-dynamic';

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang: langParam } = await searchParams;
  const catalog = await loadCatalog(slug);
  if (!catalog) notFound();

  // Tenant setting is the default; a valid ?lang= param wins (testing/embeds).
  const settingLang = catalog.settings?.widget_language;
  const lang: WidgetLanguage = isWidgetLanguage(langParam)
    ? langParam
    : isWidgetLanguage(settingLang)
      ? settingLang
      : 'en';

  return <BookingWidget slug={slug} catalog={catalog} lang={lang} />;
}
