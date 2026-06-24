const KEY = "matara_business_filter";

export function getBusinessFilter(): string {
  if (typeof window === "undefined") return "all";
  return localStorage.getItem(KEY) || "all";
}

export function setBusinessFilter(val: string) {
  localStorage.setItem(KEY, val);
  window.dispatchEvent(new Event("businessFilterChange"));
}
