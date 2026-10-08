import { RequireAuth } from "@/components/layout/RequireAuth";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
