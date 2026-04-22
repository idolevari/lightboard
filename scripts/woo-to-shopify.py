#!/usr/bin/env python3
"""
WooCommerce SQL → Shopify CSV migration
Extracts customers and orders from a WooCommerce SQL dump.
Outputs two CSV files ready for Shopify import.
"""
import re
import csv
from collections import defaultdict
from pathlib import Path

SQL_FILE = "/Users/idolevari/Downloads/lightboard.co.il_bm1776845536dm/databases/lighgewi_up1.sql"
OUTPUT_DIR = Path("/Users/idolevari/Downloads/shopify-import")
OUTPUT_DIR.mkdir(exist_ok=True)

# ── 1. Read SQL ──────────────────────────────────────────────────────────────
print("Reading SQL file...")
with open(SQL_FILE, "r", errors="ignore") as f:
    content = f.read()
print(f"  {len(content):,} characters read")

# ── 2. Parse postmeta ────────────────────────────────────────────────────────
print("\nParsing order metadata...")
postmeta = defaultdict(dict)  # post_id -> {meta_key: meta_value}

META_FIELDS = [
    "_billing_first_name", "_billing_last_name", "_billing_email",
    "_billing_phone", "_billing_address_1", "_billing_address_2",
    "_billing_city", "_billing_state", "_billing_postcode", "_billing_country",
    "_order_total", "_payment_method_title",
]

for field in META_FIELDS:
    pattern = rf"\((\d+),(\d+),'{re.escape(field)}','((?:[^'\\]|\\.)*)'\)"
    for _, post_id, value in re.findall(pattern, content):
        value = value.replace("\\'", "'").replace("\\\\", "\\")
        postmeta[int(post_id)][field] = value

print(f"  Metadata found for {len(postmeta)} posts")

# ── 3. Parse order dates + statuses from vxd_posts ──────────────────────────
print("Parsing order dates and statuses...")
order_ids = set(postmeta.keys())
order_dates = {}
order_statuses = {}

for status in ["wc-completed", "wc-processing", "wc-pending", "wc-cancelled", "wc-refunded", "wc-failed"]:
    pattern = rf"\((\d+),\d+,'(\d{{4}}-\d{{2}}-\d{{2}} \d{{2}}:\d{{2}}:\d{{2}})'[^)]*'{re.escape(status)}'[^)]*'shop_order'"
    for post_id, date in re.findall(pattern, content):
        pid = int(post_id)
        if pid in order_ids:
            order_dates[pid] = date
            order_statuses[pid] = status

print(f"  Dates resolved for {len(order_dates)} orders")

# ── 4. Parse order line items ────────────────────────────────────────────────
print("Parsing order items...")
order_items = defaultdict(list)  # order_id -> [item_name, ...]

for _, item_name, order_id in re.findall(r"\((\d+),'((?:[^'\\]|\\.)*?)','line_item',(\d+)\)", content):
    order_items[int(order_id)].append(item_name.replace("\\'", "'"))

print(f"  Items found for {len(order_items)} orders")

# ── 5. Build unique customers ────────────────────────────────────────────────
print("\nBuilding customer list...")
customers = {}  # email -> customer dict

for post_id, meta in postmeta.items():
    email = meta.get("_billing_email", "").strip().lower()
    if not email:
        continue
    total = float(meta.get("_order_total", 0) or 0)
    country_code = meta.get("_billing_country", "")
    country_name = "Israel" if country_code == "IL" else country_code

    if email not in customers:
        customers[email] = {
            "First Name": meta.get("_billing_first_name", ""),
            "Last Name": meta.get("_billing_last_name", ""),
            "Email": email,
            "Accepts Email Marketing": "no",
            "Default Address Company": "",
            "Default Address Address1": meta.get("_billing_address_1", ""),
            "Default Address Address2": meta.get("_billing_address_2", ""),
            "Default Address City": meta.get("_billing_city", ""),
            "Default Address Province Code": meta.get("_billing_state", ""),
            "Default Address Country Code": country_code,
            "Default Address Zip": meta.get("_billing_postcode", ""),
            "Default Address Phone": meta.get("_billing_phone", ""),
            "Phone": meta.get("_billing_phone", ""),
            "Accepts SMS Marketing": "no",
            "Tags": "woocommerce-import",
            "Note": "",
            "Tax Exempt": "no",
        }
    else:
        pass

print(f"  {len(customers)} unique customers")

# ── 6. Write customers.csv ───────────────────────────────────────────────────
customers_file = OUTPUT_DIR / "customers.csv"
customer_fields = [
    "First Name", "Last Name", "Email", "Accepts Email Marketing",
    "Default Address Company", "Default Address Address1", "Default Address Address2",
    "Default Address City", "Default Address Province Code", "Default Address Country Code",
    "Default Address Zip", "Default Address Phone", "Phone", "Accepts SMS Marketing",
    "Tags", "Note", "Tax Exempt",
]
with open(customers_file, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=customer_fields)
    writer.writeheader()
    for c in customers.values():
        writer.writerow(c)

print(f"\n✓ customers.csv  →  {len(customers)} rows")

# ── 7. Write orders.csv ──────────────────────────────────────────────────────
orders_file = OUTPUT_DIR / "orders.csv"
order_fields = [
    "Order ID", "Date", "Status", "Email", "First Name", "Last Name",
    "Phone", "City", "Country", "Total (ILS)", "Payment Method", "Items",
]
order_count = 0
with open(orders_file, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=order_fields)
    writer.writeheader()
    for post_id, meta in sorted(postmeta.items()):
        email = meta.get("_billing_email", "")
        if not email:
            continue
        status = order_statuses.get(post_id, "wc-completed")
        writer.writerow({
            "Order ID": post_id,
            "Date": order_dates.get(post_id, ""),
            "Status": status,
            "Email": email,
            "First Name": meta.get("_billing_first_name", ""),
            "Last Name": meta.get("_billing_last_name", ""),
            "Phone": meta.get("_billing_phone", ""),
            "City": meta.get("_billing_city", ""),
            "Country": "Israel" if meta.get("_billing_country") == "IL" else meta.get("_billing_country", ""),
            "Total (ILS)": meta.get("_order_total", ""),
            "Payment Method": meta.get("_payment_method_title", ""),
            "Items": " | ".join(order_items.get(post_id, [])),
        })
        order_count += 1

print(f"✓ orders.csv     →  {order_count} rows")
print(f"\nFiles saved to: {OUTPUT_DIR}")