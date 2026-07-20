"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const projectLinks = [
  { href: "/app", label: "Overview" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/items", label: "Items" },
  { href: "/app/decisions", label: "Decisions" },
  { href: "/app/risks", label: "Risks" },
  { href: "/app/dependencies", label: "Dependencies" },
] as const;

function isCurrentPath(pathname: string, href: string) {
  return href === "/app"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function ProjectNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Project navigation" className="border-t border-rule bg-white">
      <ul className="mx-auto flex w-full max-w-[90rem] flex-wrap gap-x-1 gap-y-1 px-4 py-2 sm:px-8 lg:px-12">
        {projectLinks.map((link) => {
          const current = isCurrentPath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-sm px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
                  current
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
