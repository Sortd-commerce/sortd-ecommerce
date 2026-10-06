function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden />;
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <Block className="skeleton--title" />
      <Block className="skeleton--subtitle" />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="panel p-4">
          <Block className="skeleton--label" />
          <Block className="skeleton--stat" />
        </div>
      ))}
    </section>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel overflow-hidden" aria-hidden>
      <div className="skeleton-table-head">
        {Array.from({ length: 5 }).map((_, index) => (
          <Block key={index} className="skeleton--th" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <Block key={index} className="skeleton--tr" />
      ))}
    </div>
  );
}

export function PanelSkeleton({ tall = false }: { tall?: boolean }) {
  return <Block className={tall ? "skeleton--panel-tall" : "skeleton--panel"} aria-hidden />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 page-loading" aria-busy="true" aria-label="Loading dashboard">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <section className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton tall />
        <PanelSkeleton tall />
      </section>
    </div>
  );
}

export function OrdersSkeleton() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading orders">
      <PageHeaderSkeleton />
      <TableSkeleton />
    </div>
  );
}

export function ProductsSkeleton() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading products">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}

export function ProductEditorSkeleton() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading product">
      <PageHeaderSkeleton />
      <PanelSkeleton tall />
      <PanelSkeleton />
      <PanelSkeleton tall />
    </div>
  );
}

export function DeliverySkeleton() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading delivery settings">
      <PageHeaderSkeleton />
      <PanelSkeleton tall />
      <PanelSkeleton tall />
      <PanelSkeleton />
      <PanelSkeleton tall />
    </div>
  );
}

export function MembersSkeleton() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading members">
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} />
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading order">
      <PageHeaderSkeleton />
      <PanelSkeleton tall />
      <PanelSkeleton />
    </div>
  );
}
