import React from "react";
import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const filteredItems = items.filter(
    (item) => item.label.toLowerCase() !== "accueil" && item.href !== "/"
  );

  return (
    <nav
      aria-label="Fil d'Ariane"
      className={`mb-4 text-[13px] md:text-[14px] italic text-gray-500 flex items-center gap-2 flex-wrap ${className}`}
    >
      <Link href="/" className="hover:text-black transition-colors not-italic">
        Accueil
      </Link>
      {filteredItems.map((item, index) => {
        const isLast = index === filteredItems.length - 1;
        return (
          <React.Fragment key={index}>
            <span className="not-italic text-gray-400">/</span>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-black transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-black font-semibold not-italic">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
