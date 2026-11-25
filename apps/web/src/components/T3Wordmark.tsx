import type { SVGProps } from "react";

/** The brand mark: a spool, seen from the side, with one thread leaving it. */
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="15.5309 37 94.3941 56.96" xmlns="http://www.w3.org/2000/svg">
      <g fill="currentColor">
        <rect x="42.73" y="38.5" width="40" height="8.4" rx="4.2" />
        <rect x="42.73" y="84.06" width="40" height="8.4" rx="4.2" />
        <rect x="51.93" y="46.9" width="21.6" height="37.16" rx="2.6" />
      </g>
      <path
        d="M78 88.26 C 88.4 88.26, 92.6 83.2, 91.9 76"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
