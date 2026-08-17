import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";

// Shell for every authenticated product surface. The auth gate itself arrives
// with the API in a later phase; the layout boundary is here so it only has to
// be added in one place.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
