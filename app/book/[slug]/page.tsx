import { notFound } from 'next/navigation';
import { loadCatalog } from './catalog-loader';
import BookingWidget from './booking-widget';

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await loadCatalog(slug);
  if (!catalog) notFound();
  return <BookingWidget slug={slug} catalog={catalog} />;
}
