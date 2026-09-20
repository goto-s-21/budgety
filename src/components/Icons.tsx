import type { ReactElement, SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export const IconFood = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3v7a3 3 0 0 0 6 0V3M9 3v7M6 3v3M15 3c0 3-1.5 5-1.5 8s1.5 10 1.5 10M15 3c1.7 0 3 2 3 5s-1.3 5-3 5" />
  </svg>
)

export const IconConvenience = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 9l1-5h14l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 21v-6h6v6" />
  </svg>
)

export const IconDining = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18 2v9a2 2 0 0 1-2 2v9M18 2a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3M6 2v20M4 2v6a2 2 0 0 0 4 0V2" />
  </svg>
)

export const IconDaily = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 9V6a4 4 0 0 1 8 0v3M5 9h14l-1.2 10.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8L5 9z" />
  </svg>
)

export const IconBeauty = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2c1.5 3 4 4 4 8a4 4 0 0 1-8 0c0-4 2.5-5 4-8z" />
    <path d="M8 22c0-3 1.8-5 4-5s4 2 4 5" />
  </svg>
)

export const IconFashion = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 3l3 2 3-2 4 4-2.5 2.5L18 9v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l1.5-1.5L5 5l4-2z" />
  </svg>
)

export const IconTransit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="13" rx="3" />
    <path d="M4 12h16M8 20l1.5-3M16 20l-1.5-3M8.5 8.5h.01M15.5 8.5h.01" />
  </svg>
)

export const IconCommunication = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
)

export const IconSubscription = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-14 5.3M4 20v-4h4" />
  </svg>
)

export const IconMedical = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21c-4-3-8-6.5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 4.5-4 8-8 11z" />
    <path d="M12 9v4M10 11h4" />
  </svg>
)

export const IconSocial = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.3" />
    <path d="M15.5 14c2.4.2 4.5 1.8 4.5 4" />
  </svg>
)

export const IconHobby = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2l2.6 5.4 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 2z" />
  </svg>
)

export const IconTravel = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 13l7-1 4-9 2 1-2 8 6-1 1.5 2-7 3-3 6-2-1 1-4-6-2 1.5-2z" />
  </svg>
)

export const IconStudy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6.5C6 5 9 4 12 4s6 1 8 2.5M4 6.5V17c2 1.5 5 2.5 8 2.5s6-1 8-2.5V6.5M12 4v15.5" />
  </svg>
)

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 11l8-7 8 7M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
  </svg>
)

export const IconOther = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
)

export const IconUncategorized = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.5-1 1-1 1.7" />
    <path d="M12 17h.01" />
  </svg>
)

export const IconIncome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M6 11l6-6 6 6" />
  </svg>
)

export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} width={14} height={14}>
    <path d="M4 20l1-4 11-11 3 3-11 11-4 1z" />
    <path d="M14 6l3 3" />
  </svg>
)

const CATEGORY_ICON_MAP: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  食費: IconFood,
  コンビニ: IconConvenience,
  外食: IconDining,
  日用品: IconDaily,
  美容: IconBeauty,
  '服・ファッション': IconFashion,
  交通: IconTransit,
  通信: IconCommunication,
  サブスク: IconSubscription,
  医療: IconMedical,
  交際費: IconSocial,
  趣味: IconHobby,
  旅行: IconTravel,
  学習: IconStudy,
  '家賃・住居': IconHome,
  その他: IconOther,
  未分類: IconUncategorized,
}

export function CategoryIcon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const Comp = CATEGORY_ICON_MAP[name] || IconUncategorized
  return <Comp {...props} />
}