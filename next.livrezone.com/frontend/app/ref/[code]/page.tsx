import { redirect } from "next/navigation";

/**
 * Route courte partagée par les parrains : /ref/CODE → /?ref=CODE (format
 * canonical traité par le ReferralTracker au chargement de la landing).
 */
export default async function RefCodePage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    redirect(`/?ref=${encodeURIComponent(code)}`);
}
