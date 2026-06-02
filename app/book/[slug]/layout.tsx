export default function BookingWidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-sans antialiased bg-zinc-950 min-h-screen text-white">
      {children}
    </div>
  );
}
