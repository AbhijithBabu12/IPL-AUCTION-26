/**
 * Admin layout — no sidebar, no main nav.
 * Access only via direct URL /admin.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
