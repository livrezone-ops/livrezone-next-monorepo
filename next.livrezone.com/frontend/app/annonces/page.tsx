import React, { Suspense } from "react";
import ListingsSearch from "@/components/ListingsSearch";

export default function AnnoncesPage() {
  return (
    <div className="w-[90%] max-w-7xl mx-auto py-8">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D28D9]"></div>
        </div>
      }>
        <ListingsSearch />
      </Suspense>
    </div>
  );
}
