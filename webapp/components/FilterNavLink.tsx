"use client";

import { useRouter } from "next/navigation";

/** Nav item for popover menus — uses capture-phase click so Base UI dismiss doesn't swallow it. */
export default function FilterNavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}
