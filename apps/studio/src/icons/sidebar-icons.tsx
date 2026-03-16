export const SpacetimeLogoIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 640"
    class={props.class}
    aria-hidden="true"
  >
    <g clip-path="url(#logo-clip)">
      <path
        class="logo-path"
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M514.832 308.261C510.567 208.836 529.176 151.399 622 45L470.805 197.793L457.45 211.29C445.419 223.447 444.68 242.492 452.167 257.87C478.81 312.596 469.606 380.633 424.553 426.162C379.691 471.498 312.743 480.913 258.708 454.407C243.11 446.756 223.705 447.505 211.485 459.854L198.573 472.903L198.7 473.01L144.099 528.589C185.326 504.458 248.988 511.382 287.392 515.558C298.029 516.715 306.728 517.661 312.476 517.678C365.084 520.293 418.548 501.3 458.727 460.697C500.074 418.912 518.776 362.908 514.832 308.261ZM326.524 122.322C332.272 122.339 340.971 123.285 351.608 124.442C390.012 128.619 453.674 135.542 494.901 111.412L440.3 166.99L440.427 167.097L427.515 180.146C415.295 192.495 395.89 193.245 380.292 185.593C326.257 159.087 259.309 168.502 214.447 213.838C169.394 259.367 160.19 327.404 186.833 382.131C194.32 397.509 193.581 416.553 181.55 428.71L168.195 442.207L17 595C109.824 488.601 128.433 431.164 124.168 331.74C120.224 277.092 138.926 221.088 180.273 179.304C220.452 138.701 273.916 119.707 326.524 122.322ZM435.847 320C435.847 384.935 383.757 437.576 319.5 437.576C255.243 437.576 203.153 384.935 203.153 320C203.153 255.064 255.243 202.423 319.5 202.423C383.757 202.423 435.847 255.064 435.847 320ZM444.797 320C444.797 389.93 388.7 446.621 319.5 446.621C250.3 446.621 194.203 389.93 194.203 320C194.203 250.069 250.3 193.378 319.5 193.378C388.7 193.378 444.797 250.069 444.797 320Z"
      />
      <path
        class="logo-circle"
        d="M439.25 320C439.25 386.136 385.636 439.75 319.5 439.75C253.364 439.75 199.75 386.136 199.75 320C199.75 253.864 253.364 200.25 319.5 200.25C385.636 200.25 439.25 253.864 439.25 320Z"
        stroke-width="8"
      />
    </g>
    <defs>
      <clipPath id="logo-clip">
        <rect width="640" height="640" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

export const DatabaseIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
)

export const SqlIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
)

export const SettingsIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const TableIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M12 3v18" />
    <rect width="18" height="18" x="3" y="3" rx="0" ry="0" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
  </svg>
)

export const FileJsonIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 12a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-4z" />
    <path d="M12 15h.01" />
  </svg>
)

export const DocumentationIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

export const RefreshCwIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
)

export const ArrowUpRightIcon = (props: { class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M7 17L17 7" />
    <path d="M7 7h10v10" />
  </svg>
)
