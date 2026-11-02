import { redirect } from "next/navigation";

// The flagship landing now lives at the home page ("/"). Keep /tour working
// for any shared links by redirecting to it.
export default function TourPage() {
  redirect("/");
}
