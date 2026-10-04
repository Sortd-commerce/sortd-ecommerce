import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Report = {
  lab_name: string;
  accreditation: string;
  tested_on: string;
  summary: string;
  passed: boolean;
  sections: Array<{
    title: string;
    results: Array<{ analyte: string; detected_value: string; unit: string; limit_value: string; passed: boolean }>;
  }>;
};

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await apiFetch<Report>(`/products/${slug}/report`, { auth: false });
  if (!result.ok || !result.data) {
    notFound();
  }
  const report = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <Link href={`/products/${slug}`} className="text-sm text-leaf">
        ← Back to product
      </Link>
      <section className="card-quiet rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.18em] text-citrus">Lab report</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-forest">{report.lab_name}</h1>
        <p className="mt-2 text-ink/70">{report.summary}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink/60">
          <span>{report.accreditation || "Accredited lab"}</span>
          <span>Tested {report.tested_on}</span>
          <span className={report.passed ? "text-leaf" : "text-citrus"}>
            {report.passed ? "All parameters within limits" : "Review required"}
          </span>
        </div>
      </section>
      {report.sections.map((section) => (
        <section key={section.title} className="card-quiet overflow-hidden rounded-[1.6rem]">
          <div className="border-b border-line px-6 py-4 font-semibold text-forest">{section.title}</div>
          <div className="divide-y divide-line">
            {section.results.map((row) => (
              <div key={row.analyte} className="grid gap-2 px-6 py-4 text-sm md:grid-cols-4">
                <p className="font-medium">{row.analyte}</p>
                <p>
                  {row.detected_value} {row.unit}
                </p>
                <p className="text-ink/60">Limit {row.limit_value || "—"}</p>
                <p className={row.passed ? "text-leaf" : "text-citrus"}>{row.passed ? "PASS" : "FAIL"}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
