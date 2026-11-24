export type Niche = {
  slug: string;
  category: string; // value pre-filled into the form
  plural: string;
  title: string;
  h1: string;
  description: string;
  synonym: string; // alternative phrase customers use
  services: string[]; // specific things customers ask about
  examplePrompts: string[];
};

export const NICHES: Niche[] = [
  {
    slug: "dentists",
    category: "dentist",
    plural: "dentists",
    title: "Does ChatGPT Recommend Your Dental Clinic? Free AI Visibility Check",
    h1: "Does ChatGPT recommend your dental clinic?",
    description:
      "Patients now ask ChatGPT, Gemini and Perplexity for the best dentist near them. Check for free whether your clinic shows up.",
    synonym: "dental clinic",
    services: ["root canal", "teeth whitening", "braces", "dental implants"],
    examplePrompts: ["best dentist in Pune", "affordable dentist near Koregaon Park", "top rated dental clinic Pune"],
  },
  {
    slug: "restaurants",
    category: "restaurant",
    plural: "restaurants",
    title: "Does ChatGPT Recommend Your Restaurant? Free AI Visibility Check",
    h1: "Does ChatGPT recommend your restaurant?",
    description:
      "Diners ask AI assistants where to eat tonight. Find out for free if ChatGPT, Gemini and Perplexity mention your restaurant.",
    synonym: "place to eat",
    services: ["family dinner", "date night", "late night food", "vegetarian food"],
    examplePrompts: ["best restaurant in Mumbai", "romantic dinner spot in Bangalore", "top rated family restaurant Delhi"],
  },
  {
    slug: "salons",
    category: "salon",
    plural: "salons",
    title: "Does ChatGPT Recommend Your Salon? Free AI Visibility Check",
    h1: "Does ChatGPT recommend your salon?",
    description:
      "Clients ask AI for the best salon in their city. See for free whether ChatGPT, Gemini and Perplexity recommend yours.",
    synonym: "beauty parlour",
    services: ["haircut", "bridal makeup", "hair colour", "facial"],
    examplePrompts: ["best salon in Pune", "affordable beauty parlour near me", "top rated bridal makeup artist Mumbai"],
  },
  {
    slug: "real-estate",
    category: "real estate agent",
    plural: "real estate agents",
    title: "Does ChatGPT Recommend Your Real Estate Business? Free AI Visibility Check",
    h1: "Does ChatGPT recommend your real estate business?",
    description:
      "Buyers and renters ask AI which agents to trust. Check for free if ChatGPT, Gemini and Perplexity recommend your agency.",
    synonym: "property dealer",
    services: ["flats for sale", "rental homes", "commercial property", "property investment"],
    examplePrompts: ["best real estate agent in Pune", "trusted property dealer in Hyderabad", "top real estate agency Delhi"],
  },
];

export const nicheBySlug = (slug: string) => NICHES.find((n) => n.slug === slug);

export const nicheForCategory = (category: string) => {
  const c = category.toLowerCase();
  return NICHES.find(
    (n) =>
      c.includes(n.category) ||
      c.includes(n.synonym) ||
      (n.slug === "dentists" && c.includes("dent")) ||
      (n.slug === "salons" && (c.includes("salon") || c.includes("parlour") || c.includes("spa"))) ||
      (n.slug === "real-estate" && (c.includes("real estate") || c.includes("property") || c.includes("realtor"))),
  );
};
