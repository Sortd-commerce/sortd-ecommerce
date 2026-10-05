import Link from "next/link";

type Fact = {
  name: string;
  amount: string;
  unit: string;
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

function levelClass(level: string) {
  if (level === "high") return "bg-[#f4ddd6] text-[#8a3b2a]";
  if (level === "medium") return "bg-[#f4ead0] text-[#7a5a1e]";
  if (level === "low") return "bg-[#dcecdc] text-[#2f5a3a]";
  return "bg-sand text-ink/70";
}

export function LabelChecked({ slug, label, hasPassedReport }: { slug: string; label: Label; hasPassedReport: boolean }) {
  const highlights = label.facts.filter((fact) => fact.is_highlight);
  const tableFacts = label.facts;
  const shares = label.ingredients.filter((row) => row.share_percent);
  const checks = label.checks;

  return (
    <section className="label-section">
      <div className="label-intro">
        <h2>The label, checked.</h2>
        <p>More on this product</p>
      </div>
      {label.headline ? <p className="label-headline">{label.headline}</p> : null}
      <nav className="label-tabs" aria-label="Label sections">
        <a href="#nutrition">Nutrition</a>
        <a href="#ingredients">Ingredients</a>
        <a href="#checks">Checks</a>
      </nav>
      <div className="label-grid">
        <div id="nutrition" className="label-card">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-forest">Nutrition</h3>
            <p className="text-xs uppercase tracking-[0.12em] text-ink/45">
              {label.serving_basis}
              {label.serving_size ? ` · ${label.serving_size}` : ""}
            </p>
          </div>
          {highlights.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {highlights.map((fact) => (
                <div key={fact.name} className="rounded-2xl bg-forest px-3 py-3 text-white">
                  <p className="text-xl font-semibold">
                    {fact.amount}
                    {fact.unit ? ` ${fact.unit}` : ""}
                  </p>
                  <p className="text-xs uppercase tracking-[0.12em] opacity-80">{fact.name}</p>
                </div>
              ))}
            </div>
          ) : null}
          <dl className="mt-4 space-y-2 text-sm">
            {tableFacts.map((fact) => (
              <div key={`${fact.group}-${fact.name}`} className={`flex items-start justify-between gap-3 ${fact.is_subfact ? "pl-3 text-ink/70" : ""}`}>
                <dt>
                  {fact.name}
                  {fact.level ? (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${levelClass(fact.level)}`}>
                      {fact.level}
                    </span>
                  ) : null}
                  {fact.note ? <p className="text-xs text-ink/50">{fact.note}</p> : null}
                </dt>
                <dd className="font-medium">
                  {fact.amount}
                  {fact.unit ? ` ${fact.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
          {label.note ? <p className="mt-4 text-xs text-ink/55">{label.note}</p> : null}
        </div>

        <div id="ingredients" className="label-card">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-forest">Ingredients</h3>
            <p className="text-xs uppercase tracking-[0.12em] text-ink/45">{label.ingredients.length} in total</p>
          </div>
          {shares.length ? (
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-sand">
              {shares.map((row) => (
                <span key={row.name} className="bg-leaf" style={{ width: `${row.share_percent}%`, opacity: 0.4 + Number(row.share_percent) / 80 }} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/55">Shares not printed on pack.</p>
          )}
          <ol className="mt-4 space-y-2 text-sm">
            {label.ingredients.map((row, index) => (
              <li key={row.name} className="flex justify-between gap-3">
                <span>
                  {index + 1}. {row.name}
                  {row.detail ? <span className="block text-xs text-ink/50">{row.detail}</span> : null}
                </span>
                {row.share_percent ? <span className="text-ink/55">{Number(row.share_percent)}%</span> : null}
              </li>
            ))}
          </ol>
          {label.allergens.length ? (
            <p className="mt-4 text-xs text-ink/60">
              Contains{" "}
              {label.allergens.map((row) => `${row.name}${row.detail ? ` · ${row.detail}` : ""}`).join(" · ")}
            </p>
          ) : null}
        </div>

        <div id="checks" className="label-card">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-forest">Sortd checks</h3>
            <p className="text-xs uppercase tracking-[0.12em] text-leaf">
              {checks.banned_found === 0 && checks.hidden_sugars_found === 0 ? "All clear" : "Review"}
            </p>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <p className="font-medium">Banned ingredients</p>
              <p className="text-ink/60">{checks.banned_found === 0 ? "None found" : `${checks.banned_found} found`}</p>
            </li>
            <li>
              <p className="font-medium">Hidden sugar names</p>
              <p className="text-ink/60">
                {checks.hidden_sugars_found === 0 ? "None found" : `${checks.hidden_sugars_found} found`}
              </p>
            </li>
            <li>
              <p className="font-medium">{checks.sugar_source ? "Sugar source" : "Ingredient shares on pack"}</p>
              <p className="text-ink/60">
                {checks.sugar_source || (checks.shares_printed ? "Printed" : "Not printed")}
              </p>
            </li>
            <li>
              <p className="font-medium">Lab report</p>
              <p className="text-ink/60">
                {checks.lab_total_count
                  ? `${checks.lab_passed_count} / ${checks.lab_total_count} within limits`
                  : hasPassedReport
                    ? "On file"
                    : "Not attached yet"}
              </p>
              {hasPassedReport || checks.lab_total_count ? (
                <Link href={`/products/${slug}/report`} className="mt-1 inline-flex text-sm font-semibold text-citrus">
                  View
                </Link>
              ) : null}
            </li>
            <li>
              <p className="font-medium">Nutritionist note</p>
              <p className="text-ink/60">{checks.nutritionist_note || "[To be written by Sortd]"}</p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
