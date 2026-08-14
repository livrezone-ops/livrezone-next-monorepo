import { notFound } from "next/navigation";
import ListingDetailFetcher from "./ListingDetailFetcher";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    nickname: string;
    slug: string;
  }>;
}

export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;

  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) return notFound();

  return <ListingDetailFetcher id={match[1]} />;
}