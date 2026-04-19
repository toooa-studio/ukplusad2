// Registry型定義
type RegistryItem = {
  name: string;
  type: string;
  description: string;
  files: Array<{
    path: string;
    type: string;
  }>;
};

type Registry = RegistryItem[];

export const registry: Registry = [
  // Header Components
  {
    name: "header-01",
    type: "registry:ui",
    description: "Header component 01",
    files: [
      {
        path: "../components/Header/Header01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-02",
    type: "registry:ui",
    description: "Header component 02",
    files: [
      {
        path: "../components/Header/Header02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-03",
    type: "registry:ui",
    description: "Header component 03",
    files: [
      {
        path: "../components/Header/Header03.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-04",
    type: "registry:ui",
    description: "Header component 04",
    files: [
      {
        path: "../components/Header/Header04.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-05",
    type: "registry:ui",
    description: "Header component 05",
    files: [
      {
        path: "../components/Header/Header05.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-06",
    type: "registry:ui",
    description: "Header component 06",
    files: [
      {
        path: "../components/Header/Header06.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-07",
    type: "registry:ui",
    description: "Header component 07",
    files: [
      {
        path: "../components/Header/Header07.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-08",
    type: "registry:ui",
    description: "Header component 08",
    files: [
      {
        path: "../components/Header/Header08.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "header-09",
    type: "registry:ui",
    description: "Header component 09",
    files: [
      {
        path: "../components/Header/Header09.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Hero Components
  {
    name: "hero-01",
    type: "registry:ui",
    description: "Hero section component 01",
    files: [
      {
        path: "../components/Hero/Hero01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-02",
    type: "registry:ui",
    description: "Hero section component 02",
    files: [
      {
        path: "../components/Hero/Hero02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-03",
    type: "registry:ui",
    description: "Hero section component 03",
    files: [
      {
        path: "../components/Hero/Hero03.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-04",
    type: "registry:ui",
    description: "Hero section component 04",
    files: [
      {
        path: "../components/Hero/Hero04.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-05",
    type: "registry:ui",
    description: "Hero section component 05",
    files: [
      {
        path: "../components/Hero/Hero05.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-06",
    type: "registry:ui",
    description: "Hero section component 06",
    files: [
      {
        path: "../components/Hero/Hero06.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-07",
    type: "registry:ui",
    description: "Hero section component 07",
    files: [
      {
        path: "../components/Hero/Hero07.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-08",
    type: "registry:ui",
    description: "Hero section component 08",
    files: [
      {
        path: "../components/Hero/Hero08.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "hero-09",
    type: "registry:ui",
    description: "Hero section component 09",
    files: [
      {
        path: "../components/Hero/Hero09.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Features Components
  {
    name: "features-01",
    type: "registry:ui",
    description: "Features section component 01",
    files: [
      {
        path: "../components/Features/Features01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "features-02",
    type: "registry:ui",
    description: "Features section component 02",
    files: [
      {
        path: "../components/Features/Features02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "features-03",
    type: "registry:ui",
    description: "Features section component 03",
    files: [
      {
        path: "../components/Features/Features03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Onayami Components
  {
    name: "onayami-01",
    type: "registry:ui",
    description: "Onayami (concern) section component 01",
    files: [
      {
        path: "../components/Onayami/Onayami01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "onayami-02",
    type: "registry:ui",
    description: "Onayami (concern) section component 02",
    files: [
      {
        path: "../components/Onayami/Onayami02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "onayami-03",
    type: "registry:ui",
    description: "Onayami (concern) section component 03",
    files: [
      {
        path: "../components/Onayami/Onayami03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Voice Components
  {
    name: "voice-01",
    type: "registry:ui",
    description: "Customer voice component 01",
    files: [
      {
        path: "../components/Voice/Voice01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "voice-02",
    type: "registry:ui",
    description: "Customer voice component 02",
    files: [
      {
        path: "../components/Voice/Voice02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "voice-03",
    type: "registry:ui",
    description: "Customer voice component 03",
    files: [
      {
        path: "../components/Voice/Voice03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Price Components
  {
    name: "price-01",
    type: "registry:ui",
    description: "Price section component 01",
    files: [
      {
        path: "../components/Price/Price01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "price-02",
    type: "registry:ui",
    description: "Price section component 02",
    files: [
      {
        path: "../components/Price/Price02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "price-03",
    type: "registry:ui",
    description: "Price section component 03",
    files: [
      {
        path: "../components/Price/Price03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Company Components
  {
    name: "company-01",
    type: "registry:ui",
    description: "Company information component 01",
    files: [
      {
        path: "../components/Company/Company01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "company-02",
    type: "registry:ui",
    description: "Company information component 02",
    files: [
      {
        path: "../components/Company/Company02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "company-03",
    type: "registry:ui",
    description: "Company information component 03",
    files: [
      {
        path: "../components/Company/Company03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Contact Components
  {
    name: "contact-01",
    type: "registry:ui",
    description: "Contact form component 01",
    files: [
      {
        path: "../components/Contact/Contact01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "contact-02",
    type: "registry:ui",
    description: "Contact form component 02",
    files: [
      {
        path: "../components/Contact/Contact02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "contact-03",
    type: "registry:ui",
    description: "Contact form component 03",
    files: [
      {
        path: "../components/Contact/Contact03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // FAQ Components
  {
    name: "faq-01",
    type: "registry:ui",
    description: "FAQ component with custom styling 01",
    files: [
      {
        path: "../components/Faq/Faq01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "faq-02",
    type: "registry:ui",
    description: "FAQ component 02",
    files: [
      {
        path: "../components/Faq/Faq02.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "faq-03",
    type: "registry:ui",
    description: "FAQ component 03",
    files: [
      {
        path: "../components/Faq/Faq03.tsx",
        type: "registry:ui"
      }
    ]
  },
  // Utility Components
  {
    name: "white-space-01",
    type: "registry:ui",
    description: "White space component for layout",
    files: [
      {
        path: "../components/WhiteSpace01.tsx",
        type: "registry:ui"
      }
    ]
  },
  {
    name: "black-space",
    type: "registry:ui",
    description: "Black space component for layout",
    files: [
      {
        path: "../components/BlackSpace.tsx",
        type: "registry:ui"
      }
    ]
  }
];