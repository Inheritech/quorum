import { App } from "@/components/app";
// Per-request nonces require dynamic rendering. Room content is still client-only.
export const dynamic = "force-dynamic";
export default function Page() {
  return <App />;
}
