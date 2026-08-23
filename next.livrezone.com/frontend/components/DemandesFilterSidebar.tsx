"use client";

import React from "react";
import FilterSidebar from "./FilterSidebar";
import type { CityRef } from "@/lib/listings-api";

interface DemandesFilterSidebarProps {
  cities?: CityRef[];
  basePath?: string;
}

export default function DemandesFilterSidebar({
  cities = [],
  basePath = "/demandes",
}: DemandesFilterSidebarProps) {
  return (
    <FilterSidebar
      sections={["categories", "languages", "cities"]}
      cities={cities}
      basePath={basePath}
    />
  );
}
