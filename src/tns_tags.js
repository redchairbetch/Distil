// TNS objection tags — multi-selectable reasons a patient did not proceed at point of sale.
// Order here = display order in the tagging UI grid.
// IDs are the only values allowed in tns_outcomes.outcome_reasons (see migration 004).

export const TNS_TAGS = [
  { id: "not_ready",            label: "Not Ready / Denial",      emoji: "\u{1F648}" },
  { id: "cost",                 label: "Cost",                    emoji: "\u{1F4B0}" },
  { id: "insurance_confusion",  label: "Insurance Confusion",     emoji: "\u{1F4CB}" },
  { id: "vanity",               label: "Vanity / Cosmetics",      emoji: "\u{1FA9E}" },
  { id: "age_stigma",           label: "Age / Stigma",            emoji: "\u{1F614}" },
  { id: "shopping",             label: "Shopping Around",         emoji: "\u{1F6CD}\u{FE0F}" },
  { id: "prior_bad_experience", label: "Prior Bad Experience",    emoji: "\u{26A0}\u{FE0F}" },
  { id: "maintenance_burden",   label: "Maintenance Burden",      emoji: "\u{1F9FD}" },
  { id: "feedback_concern",     label: "Feedback / Squealing",    emoji: "\u{1F50A}" },
  { id: "fear_dependence",      label: "Fear of Dependence",      emoji: "\u{1FAA2}" },
  { id: "needs_research",       label: "Wants More Research",     emoji: "\u{1F50D}" },
  { id: "needs_spouse",         label: "Needs Spouse / Family",   emoji: "\u{1F465}" },
  { id: "tech_overwhelm",       label: "Tech Overwhelming",       emoji: "\u{1F92F}" },
  { id: "wants_otc",            label: "Wants to Try OTC First",  emoji: "\u{1F4E6}" },
  { id: "procrastination",      label: "Deal With It Later",      emoji: "\u{23F0}" },
  { id: "other",                label: "Other (see notes)",       emoji: "\u{1F4AC}" },
];

export const TNS_TAG_BY_ID = Object.fromEntries(TNS_TAGS.map(t => [t.id, t]));

export const tnsTagLabel = (id) => TNS_TAG_BY_ID[id]?.label || id;
