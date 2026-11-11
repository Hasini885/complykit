export const CLIENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
  { value: "strike-off", label: "Under strike-off" },
  { value: "closed", label: "Closed" },
];

export const CESSATION_REASONS = [
  { value: "resignation", label: "Resignation", section: "Section 168" },
  { value: "removal", label: "Removal by the members", section: "Section 169" },
  {
    value: "vacation",
    label: "Vacation of office (e.g. disqualified, absent from all meetings for 12 months)",
    section: "Section 167",
  },
  { value: "retirement", label: "Retirement by rotation, not re-appointed at the AGM", section: "Section 152(6)" },
  { value: "death", label: "Death", section: "—" },
  { value: "other", label: "Other (e.g. end of a fixed term)", section: "—" },
];

export const PORTFOLIO_VERSION = 1;

export function emptySnapshot() {
  return { clients: [], directors: [], consultants: [], activeClientId: null, version: PORTFOLIO_VERSION };
}
