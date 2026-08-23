import { redirect } from "next/navigation";

export default function CommandesRedirect() {
  redirect("/dashboard/demandes");
}
