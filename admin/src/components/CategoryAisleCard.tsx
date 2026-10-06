"use client";

import Image from "next/image";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { deleteCategoryImageAction, uploadCategoryImageAction } from "@/lib/actions";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  image_url?: string | null;
};

export function CategoryAisleCard({ category }: { category: CategoryRow }) {
  return (
    <article className="panel overflow-hidden">
      <div className="relative aspect-[4/3] bg-sand/60">
        {category.image_url ? (
          <Image
            src={category.image_url}
            alt=""
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-semibold text-muted/50">
            {category.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="font-semibold">{category.name}</h2>
          <p className="text-sm text-muted">{category.slug}</p>
        </div>

        <ActionForm action={uploadCategoryImageAction} className="space-y-2" successLabel="Aisle image uploaded.">
          <input type="hidden" name="category_id" value={category.id} />
          <label className="field">
            <span>Replace image</span>
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <SubmitButton pendingLabel="Uploading…">Upload aisle image</SubmitButton>
        </ActionForm>

        {category.image_url ? (
          <ActionForm action={deleteCategoryImageAction} successLabel="Aisle image removed.">
            <input type="hidden" name="category_id" value={category.id} />
            <SubmitButton pendingLabel="Removing…" className="btn-ghost w-full text-sm">
              Remove image
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
    </article>
  );
}
