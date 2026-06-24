// Global business filter stored in localStorage
const KEY = "matara_business_filter";

export function getBusinessFilter(): string {
  if (typeof window === "undefined") return "all";
  return localStorage.getItem(KEY) || "all";
}

export function setBusinessFilter(val: string) {
  localStorage.setItem(KEY, val);
  window.dispatchEvent(new Event("businessFilterChange"));
}

export const BUSINESSES = [
  { id: "all",         name: "כל העסקים",        type: "all"         },
  { id: "recruitment", name: "מטרה - גיוס",       type: "recruitment" },
  { id: "carpentry",   name: "נויה מטבחים",       type: "carpentry"   },
];
