"use client";

import { CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { useMobileViewport } from "@/lib/use-mobile-viewport";

type Fact = {
  name: string;
  amount: string;
  unit: string;
  daily_value?: string;
  is_highlight: boolean;
  level: string;
  note: string;
  group: string;
  is_subfact: boolean;
};

type Label = {
  serving_size: string;
  serving_basis: string;
  headline: string;
  note: string;
  guidance: string;
  facts: Fact[];
  ingredients: Array<{ name: string; share_percent: string | null; detail: string; is_flagged: boolean }>;
  allergens: Array<{ name: string; detail: string }>;
  checks: {
    banned_found: number;
    hidden_sugars_found: number;
    shares_printed: boolean;
    sugar_source: string;
    nutritionist_note: string;
    lab_passed: boolean;
    lab_passed_count: number;
    lab_total_count: number;
  };
};

type Tab = "nutrition" | "ingredients" | "checks";

const TAB_ORDER: Tab[] = ["nutrition", "ingredients", "checks"];

const ING_COLORS = ["#143503", "#2d5a20", "#4a7a2e", "#7a9e6a", "#a7c49a", "#c4b89a", "#d4c4a8", "#e8ddd0"];

const PRIMARY_ORDER = ["Energy", "Protein", "Carbohydrate", "Fat", "Total sugars", "Cacao / cocoa solids"];

const SECONDARY_NAMES = ["Fibre", "Trans fat", "Cholesterol"];

const TRAFFIC_ORDER = ["Total sugars", "Sodium", "Fat", "Saturates"];

function formatAmount(fact: Fact) {
  return `${fact.amount}${fact.unit ? ` ${fact.unit}` : ""}`;
}

function formatServingMeta(basis: string, size: string) {
  const cleanBasis = basis.trim();
  const cleanSize = size.trim();
  if (!cleanBasis && !cleanSize) return "";

  const basisOnly = cleanBasis.replace(/\s*[·•-]\s*per\s+\d+\s*g?\s*$/i, "").trim();

  if (cleanSize && /^\d+(\.\d+)?$/.test(cleanSize)) {
    const sizePart = `${cleanSize} G`;
    if (basisOnly) return `${basisOnly.toUpperCase()} · ${sizePart}`;
    return sizePart;
  }

  if (cleanBasis && cleanSize && !cleanBasis.toLowerCase().includes(cleanSize.toLowerCase())) {
    return `${cleanBasis.toUpperCase()} · ${cleanSize.toUpperCase()}`;
  }

  return (basisOnly || cleanBasis || cleanSize).toUpperCase();
}

function macroLabel(name: string) {
  if (name === "Energy") return "kcal";
  if (name === "Carbohydrate") return "carbs";
  if (name === "Cacao / cocoa solids") return "cacao";
  if (name === "Total sugars") return "total sugars";
  return name.toLowerCase();
}

function highlightVariant(name: string) {
  if (name === "Energy" || name === "Total sugars") return "label-highlight--peach";
  if (name === "Protein" || name === "Cacao / cocoa solids") return "label-highlight--forest";
  if (name === "Carbohydrate") return "label-highlight--mint";
  if (name === "Fat") return "label-highlight--sky";
  return "label-highlight--mint";
}

function trafficLabel(name: string) {
  const label = name === "Sodium" ? "Salt" : name.replace(/^Total /, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function saltAmountFromSodium(fact: Fact) {
  const sodium = Number.parseFloat(fact.amount);
  if (!Number.isFinite(sodium)) return null;
  return (sodium / 400).toFixed(2).replace(/\.?0+$/, "");
}

function trafficNote(fact: Fact, facts: Fact[], sugarSource: string) {
  if (fact.note) return fact.note;
  if (fact.name === "Sodium") return `${formatAmount(fact)} sodium`;
  if (fact.name === "Total sugars") {
    const added = facts.find((row) => row.name === "Added sugars");
    if (added) {
      const amount = Number.parseFloat(added.amount);
      if (Number.isFinite(amount) && amount === 0) {
        return sugarSource && !/none/i.test(sugarSource) ? sugarSource : "0 g added";
      }
    }
  }
  if (fact.name === "Fat") {
    const mufa = facts.find((row) => row.name === "MUFA");
    const pufa = facts.find((row) => row.name === "PUFA");
    if (mufa || pufa) {
      const unsaturated = [mufa, pufa]
        .filter(Boolean)
        .reduce((sum, row) => sum + (Number.parseFloat(row?.amount || "") || 0), 0);
      if (unsaturated > 0) return `${unsaturated.toFixed(1).replace(/\.0$/, "")} g of it unsaturated`;
    }
  }
  if (fact.name === "Saturates" && fact.daily_value) return `${fact.daily_value} of daily guidance`;
  return "";
}

function levelTone(level: string) {
  if (level === "high") return "label-traffic--high";
  if (level === "medium") return "label-traffic--medium";
  if (level === "low") return "label-traffic--low";
  return "";
}

type CheckState = "pass" | "note" | "missing";

function TabChecksBadge({ noteCount, isActive }: { noteCount: number; isActive: boolean }) {
  if (noteCount > 0) {
    return (
      <span className="label-box__tab-badge label-box__tab-badge--notes" aria-hidden>
        {noteCount}
      </span>
    );
  }

  return (
    <span
      className={`label-box__tab-badge label-box__tab-badge--clear${isActive ? " label-box__tab-badge--clear-active" : ""}`}
      aria-hidden
    >
      ✓
    </span>
  );
}

function CheckStatusIcon({ state }: { state: CheckState }) {
  if (state === "note") {
    return (
      <span className="label-check-icon label-check-icon--note" aria-hidden>
        i
      </span>
    );
  }

  if (state === "missing") {
    return <span className="label-check-icon label-check-icon--missing" aria-hidden />;
  }

  return (
    <span className="label-check-icon label-check-icon--pass" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M7.2 12.3 10.4 15.5 16.8 9.1" stroke="#f6f1e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function checkDetailClass(state: CheckState) {
  if (state === "missing") return "label-checks__detail label-checks__detail--muted";
  return "label-checks__detail label-checks__detail--status";
}

function checkRowClass(state: CheckState) {
  if (state === "note") return "label-check-row label-check-row--note";
  if (state === "missing") return "label-check-row label-check-row--missing";
  return "label-check-row label-check-row--pass";
}

function addedSugarStatus(facts: Fact[], sugarSource: string) {
  const added = facts.find((fact) => fact.name === "Added sugars");
  if (added) {
    const amount = Number.parseFloat(added.amount);
    if (Number.isFinite(amount) && amount === 0) return "None found";
    return formatAmount(added);
  }
  if (sugarSource && !/none/i.test(sugarSource)) return sugarSource;
  return "None found";
}

function addedSugarState(facts: Fact[], sugarSource: string): CheckState {
  return addedSugarStatus(facts, sugarSource) === "None found" ? "pass" : "note";
}

function labCheck(checks: Label["checks"], hasLabReport: boolean) {
  if (!hasLabReport && !checks.lab_total_count) {
    return { state: "missing" as const, detail: "Not on file" };
  }

  if (checks.lab_total_count) {
    const allPassed = checks.lab_passed_count >= checks.lab_total_count;
    return {
      state: (allPassed ? "pass" : "note") as CheckState,
      detail: `${checks.lab_passed_count} / ${checks.lab_total_count} within limits`,
    };
  }

  if (hasLabReport) {
    return {
      state: (checks.lab_passed ? "pass" : "note") as CheckState,
      detail: checks.lab_passed ? "None found" : "On file",
    };
  }

  return { state: "missing" as const, detail: "Not on file" };
}

type CheckRowData = {
  title: string;
  detail: string;
  state: CheckState;
  showReport?: boolean;
};

function buildCheckRows(
  checks: Label["checks"],
  facts: Fact[],
  hasLabReport: boolean,
): CheckRowData[] {
  const lab = labCheck(checks, hasLabReport);

  return [
    {
      title: "Banned ingredients",
      detail: checks.banned_found === 0 ? "None found" : `${checks.banned_found} found`,
      state: checks.banned_found === 0 ? "pass" : "note",
    },
    {
      title: "Hidden sugars",
      detail: checks.hidden_sugars_found === 0 ? "None found" : `${checks.hidden_sugars_found} found`,
      state: checks.hidden_sugars_found === 0 ? "pass" : "note",
    },
    {
      title: "Added sugar",
      detail: addedSugarStatus(facts, checks.sugar_source),
      state: addedSugarState(facts, checks.sugar_source),
    },
    {
      title: "Lab report",
      detail: lab.detail,
      state: lab.state,
      showReport: hasLabReport || checks.lab_total_count > 0,
    },
  ];
}

export function LabelChecked({
  label,
  hasLabReport,
  labReportUrl,
  templateLabel,
}: {
  label: Label;
  hasLabReport: boolean;
  labReportUrl: string | null;
  templateLabel: string;
}) {
  const [tab, setTab] = useState<Tab>("nutrition");
  const [slideDir, setSlideDir] = useState(0);
  const [indicator, setIndicator] = useState({ width: 0, left: 0 });
  const [accordionOpen, setAccordionOpen] = useState(false);
  const mobile = useMobileViewport();
  const tabsRef = useRef<HTMLDivElement>(null);

  const highlightPool = label.facts.filter((fact) => fact.is_highlight);
  const highlights = PRIMARY_ORDER.map((name) => highlightPool.find((fact) => fact.name === name))
    .filter((fact): fact is Fact => Boolean(fact))
    .concat(highlightPool.filter((fact) => !PRIMARY_ORDER.includes(fact.name)))
    .slice(0, 4);
  const secondaryMacros = SECONDARY_NAMES.map((name) => label.facts.find((fact) => fact.name === name)).filter(
    (fact): fact is Fact => Boolean(fact),
  );
  const trafficFacts = TRAFFIC_ORDER.map((name) => label.facts.find((fact) => fact.name === name)).filter(
    (fact): fact is Fact => Boolean(fact),
  );
  const shares = label.ingredients.filter((row) => row.share_percent);
  const checks = label.checks;
  const contains = label.allergens.filter(
    (row) => row.name !== "May contain" && !/^none/i.test(row.name.trim()),
  );
  const mayContain = label.allergens.find((row) => row.name === "May contain")?.detail || "";
  const servingMeta = formatServingMeta(label.serving_basis, label.serving_size);
  const checkRows = buildCheckRows(checks, label.facts, hasLabReport);
  const checksNoteCount = checkRows.filter((row) => row.state === "note").length;

  useLayoutEffect(() => {
    if (mobile && !accordionOpen) return;
    const track = tabsRef.current;
    if (!track) return;

    const updateIndicator = () => {
      const active = track.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      setIndicator({
        left: active.offsetLeft,
        width: active.offsetWidth,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [accordionOpen, mobile, tab]);

  function selectTab(next: Tab) {
    const currentIdx = TAB_ORDER.indexOf(tab);
    const nextIdx = TAB_ORDER.indexOf(next);
    setSlideDir(nextIdx - currentIdx);
    setTab(next);
  }

  const panelClass = slideDir >= 0 ? "label-panel--forward" : "label-panel--back";

  const labelBody = (
    <div className="label-box">
        <header className="label-box__header">
          <div className="label-box__meta">
            <span>{servingMeta || "AS PRINTED ON PACK"}</span>
            <span>{templateLabel.toUpperCase()}</span>
          </div>
          <div className="label-box__hero">
            {label.headline ? <p className="label-box__headline">{label.headline}</p> : <span />}
            <div className="label-box__tabs" ref={tabsRef} role="tablist" aria-label="Label sections">
              <span
                className="label-box__tab-indicator"
                style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
                aria-hidden
              />
              {(
                [
                  ["nutrition", "Nutrition"],
                  ["ingredients", "Ingredients"],
                  ["checks", "Checks"],
                ] as const
              ).map(([key, title]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={tab === key ? "label-box__tab label-box__tab--active" : "label-box__tab"}
                  onClick={() => selectTab(key)}
                >
                  {title}
                  {key === "checks" ? <TabChecksBadge noteCount={checksNoteCount} isActive={tab === key} /> : null}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="label-box__body">
          <div key={tab} className={`label-panel ${panelClass}`} role="tabpanel">
            {tab === "nutrition" ? (
              <div className="label-nutrition">
                <div className="label-nutrition__macros">
                  {highlights.length ? (
                    <div className="label-highlights">
                      {highlights.map((fact) => (
                        <article key={fact.name} className={`label-highlight ${highlightVariant(fact.name)}`}>
                          <p className="label-highlight__value">{formatAmount(fact)}</p>
                          <p className="label-highlight__name">{macroLabel(fact.name)}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}

                  {secondaryMacros.length ? (
                    <div className="label-secondary-macros">
                      {secondaryMacros.map((fact) => (
                        <article key={fact.name} className="label-secondary-macro">
                          <p className="label-secondary-macro__value">{formatAmount(fact)}</p>
                          <p className="label-secondary-macro__name">{macroLabel(fact.name)}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>

                {trafficFacts.length || label.note ? (
                  <div className="label-nutrition__aside">
                    <div className="label-traffic-wrap">
                      {trafficFacts.length ? (
                        <div className="label-traffic-list">
                          {trafficFacts.map((fact) => {
                            const note = trafficNote(fact, label.facts, checks.sugar_source);
                            const displayAmount =
                              fact.name === "Sodium" && saltAmountFromSodium(fact)
                                ? `${saltAmountFromSodium(fact)} g`
                                : formatAmount(fact);
                            return (
                              <article
                                key={fact.name}
                                className={`label-traffic ${fact.level ? levelTone(fact.level) : "label-traffic--neutral"}`}
                              >
                                <div className="label-traffic__row">
                                  <span className="label-traffic__dot" aria-hidden />
                                  <p className="label-traffic__title">
                                    {trafficLabel(fact.name)} <strong>{displayAmount}</strong>
                                    {fact.level ? (
                                      <>
                                        {" "}
                                        · <span className="label-traffic__level">{fact.level}</span>
                                      </>
                                    ) : null}
                                  </p>
                                </div>
                                {note ? <p className="label-traffic__note">{note}</p> : null}
                              </article>
                            );
                          })}
                        </div>
                      ) : null}
                      {label.note ? <p className="label-footnote">{label.note}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "ingredients" ? (
              <div className="label-ingredients">
                <div className="label-ingredients__head">
                  <p className="label-ingredients__kicker">By share of weight — as printed on the pack</p>
                  <span className="label-ingredients__count">{label.ingredients.length} in total</span>
                </div>

                {shares.length && checks.shares_printed ? (
                  <div className="label-ing-bar" aria-hidden>
                    {shares.map((row, index) => (
                      <span
                        key={row.name}
                        className="label-ing-bar__segment"
                        style={{ width: `${row.share_percent}%`, background: ING_COLORS[index % ING_COLORS.length] }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="label-ingredients__empty">Shares not printed on pack.</p>
                )}

                <ul className="label-ingredients__list">
                  {label.ingredients.map((row, index) => (
                    <li key={row.name}>
                      <span className="label-ingredients__swatch" style={{ background: ING_COLORS[index % ING_COLORS.length] }} aria-hidden />
                      <span className="label-ingredients__name">
                        {row.name}
                        {row.detail ? <span className="label-ingredients__detail">{row.detail}</span> : null}
                      </span>
                      {row.share_percent ? <span className="label-ingredients__pct">{Number(row.share_percent)}%</span> : null}
                    </li>
                  ))}
                </ul>

                {checks.sugar_source ? <p className="label-ingredients__note">{checks.sugar_source}</p> : null}

                {contains.length ? (
                  <div className="label-allergens">
                    <p className="label-allergens__label">Contains</p>
                    <div className="label-allergens__pills">
                      {contains.map((row) => (
                        <span key={row.name} className="label-allergens__pill">
                          {row.name}
                          {row.detail ? ` · ${row.detail}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {mayContain ? (
                  <p className="label-allergens__may">
                    <span>May contain —</span> {mayContain}
                  </p>
                ) : null}
              </div>
            ) : null}

            {tab === "checks" ? (
              <div className="label-checks">
                <ul className="label-checks__list">
                  {checkRows.map((row) => (
                    <li key={row.title} className={`${checkRowClass(row.state)}${row.showReport ? " label-checks__lab" : ""}`}>
                      <CheckStatusIcon state={row.state} />
                      <div className="label-checks__copy">
                        <p className="label-checks__title">{row.title}</p>
                        <p className={checkDetailClass(row.state)}>{row.detail}</p>
                      </div>
                      {row.showReport && labReportUrl ? (
                        <a
                          href={labReportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="label-checks__report-btn"
                        >
                          View report
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <aside className="label-checks__aside">
                  <p>
                    Every product is read against our banned list before it goes on the shelf. The same four checks, every time.
                  </p>
                  <Link href="/" className="label-checks__link">
                    See what we ban →
                  </Link>
                </aside>
              </div>
            ) : null}
          </div>
        </div>
      </div>
  );

  return (
    <section className="label-section" aria-label="The label, checked">
      {!mobile ? <h2 className="label-intro">The label, checked.</h2> : null}
      {mobile ? (
        <>
          <button
            type="button"
            className="label-accordion-trigger"
            aria-expanded={accordionOpen}
            onClick={() => setAccordionOpen((value) => !value)}
          >
            <span>More on this product</span>
            <CaretDown size={18} weight="bold" className="label-accordion-caret" data-open={accordionOpen} aria-hidden />
          </button>
          <div className={`label-accordion-panel ${accordionOpen ? "label-accordion-panel--open" : ""}`}>
            <div className="label-accordion-panel__inner">
              <div className="label-section__body">{labelBody}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="label-section__body">
          <p className="label-kicker">More on this product</p>
          {labelBody}
        </div>
      )}
    </section>
  );
}
