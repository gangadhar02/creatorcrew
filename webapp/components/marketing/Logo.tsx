"use client";

import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={`inline-flex items-center ${className ?? ""}`}
      aria-label="CreatorCrew home"
    >
      {/* Full wordmark (robot + "CreatorCrew"). Dark variant has light text so
          it stays legible on dark backgrounds. */}
      <Image
        src="/logo-wordmark.png"
        alt="CreatorCrew"
        width={2207}
        height={316}
        className="h-7 w-auto dark:hidden"
        priority
      />
      <Image
        src="/logo-wordmark-dark.png"
        alt="CreatorCrew"
        width={2207}
        height={316}
        className="hidden h-7 w-auto dark:block"
        priority
      />
    </a>
  );
}
