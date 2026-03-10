import { redirect } from "next/navigation";

// This route (/) is also claimed by app/page.tsx (public landing).
// Redirect authenticated users to /dashboard to eliminate the conflict.
export default function ProtectedRootPage() {
  redirect("/dashboard");
}
