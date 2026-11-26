export const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant or cafe" },
  { value: "sweet shop", label: "Sweet shop or bakery" },
  { value: "salon", label: "Salon or spa" },
  { value: "gym", label: "Gym or fitness studio" },
  { value: "clinic", label: "Clinic or doctor" },
  { value: "dental clinic", label: "Dental clinic" },
  { value: "coaching institute", label: "Coaching or tuition" },
  { value: "hotel", label: "Hotel or homestay" },
  { value: "retail store", label: "Retail store" },
  { value: "service business", label: "Repair or service business" },
  { value: "local business", label: "Other" },
] as const;

export function isBusinessType(value: string): boolean {
  return BUSINESS_TYPES.some((type) => type.value === value);
}
