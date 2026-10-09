"""Report product image coverage vs the Sortd_Products asset folder."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Count

from catalog.models import Product, ProductVariant
from catalog.product_assets import assign_rows_to_products, load_asset_rows


class Command(BaseCommand):
    help = "Write a JSON report of missing product images and unused asset folders."

    def add_arguments(self, parser):
        parser.add_argument(
            "--assets-dir",
            type=str,
            required=True,
            help="Path to the Sortd_Products folder containing products.json.",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=str(Path(__file__).resolve().parents[4] / "data" / "products_missing_images_report.json"),
            help="Where to write the JSON report.",
        )

    def handle(self, *args, **options):
        assets_dir = Path(options["assets_dir"])
        output = Path(options["output"])
        rows = load_asset_rows(assets_dir)
        products = list(Product.objects.prefetch_related("variants", "images").all())
        assignments = assign_rows_to_products(products, rows)
        assigned_ids = set(assignments)

        missing_in_db = []
        stale_wrong_images = []
        for product in Product.objects.annotate(image_count=Count("images")).prefetch_related("variants"):
            variant = product.variants.first()
            sku = variant.sku if variant else ""
            row = assignments.get(product.id)
            payload = {
                "sortd_sku": sku,
                "brand": product.brand,
                "title": product.title,
                "image_count": product.image_count,
                "asset_folder": row.folder if row else "",
                "asset_sku": row.sku if row else "",
            }
            if row is None and product.image_count > 0:
                stale_wrong_images.append(
                    {
                        **payload,
                        "reason": "Images were from an incorrect auto-match; removed or need replacement.",
                    }
                )
            if product.image_count == 0:
                if row:
                    payload["reason"] = "Asset folder exists but images not uploaded yet."
                else:
                    payload["reason"] = "No matching asset folder in Sortd_Products."
                missing_in_db.append(payload)

        no_folder_in_zip = []
        for row in rows:
            if not row.folder:
                no_folder_in_zip.append(
                    {"brand": row.brand, "sku": row.sku, "notes": row.notes, "reason": "Not collected in asset pack."}
                )

        unused_assets = []
        used_rows = set(id(row) for row in assignments.values())
        for row in rows:
            if not row.folder or not row.image_files:
                continue
            if id(row) not in used_rows:
                unused_assets.append({"brand": row.brand, "sku": row.sku, "folder": row.folder, "images": len(row.image_files)})

        zip_no_folder_by_key = {(item["brand"], item["sku"]): item for item in no_folder_in_zip}

        client_need_assets = []
        for item in missing_in_db:
            entry = {
                "sortd_sku": item["sortd_sku"],
                "brand": item["brand"],
                "title": item["title"],
                "action": "Send product photos (not in WeTransfer pack).",
            }
            for key in ((item["brand"], item["title"]), (item["brand"], item["asset_sku"])):
                if key[1] and key in zip_no_folder_by_key:
                    entry["asset_pack_note"] = zip_no_folder_by_key[key].get("notes") or ""
                    break
            client_need_assets.append(entry)

        report = {
            "summary": {
                "db_products": Product.objects.count(),
                "db_with_images": Product.objects.annotate(n=Count("images")).filter(n__gt=0).count(),
                "db_without_images": len(missing_in_db),
                "zip_rows_with_folders": sum(1 for row in rows if row.folder and row.image_files),
                "zip_rows_without_folders": len(no_folder_in_zip),
                "assigned_folders": len(assignments),
                "unassigned_folders": len(unused_assets),
            },
            "client_need_product_photos": client_need_assets,
            "db_products_with_stale_wrong_images": stale_wrong_images,
            "db_products_without_images": missing_in_db,
            "zip_skus_without_folders": no_folder_in_zip,
            "zip_folders_not_in_db": unused_assets,
        }

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Wrote {output}"))

        md_path = output.with_name("products_client_need_photos.md")
        lines = [
            "# Sortd launch range — product photos still needed",
            "",
            f"**Catalog:** {report['summary']['db_products']} SKUs · "
            f"**With images:** {report['summary']['db_with_images']} · "
            f"**Still need photos:** {report['summary']['db_without_images']}",
            "",
            "These Sortd SKUs are active in the catalog but have **no images** because they were "
            "not in the WeTransfer `Sortd_Products` pack (or could not be matched safely).",
            "",
            "| Sortd SKU | Brand | Product | Notes |",
            "| --- | --- | --- | --- |",
        ]
        for item in client_need_assets:
            note = item.get("asset_pack_note", "").replace("|", "/").replace("\n", " ")
            lines.append(
                f"| {item['sortd_sku']} | {item['brand']} | {item['title']} | {note or '—'} |"
            )
        lines.extend(
            [
                "",
                "All other launch SKUs are mapped to folders in `Sortd_Products` and uploaded to Cloudinary.",
                "",
            ]
        )
        md_path.write_text("\n".join(lines), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Wrote {md_path}"))
