---
name: unit-pricing-display-rules
description: Equips the advisor to verify unit-price displays are present, consistent, and comparable so consumers can make meaningful price comparisons across pack sizes and sellers.
---

# Unit Pricing Display Rules

Unit pricing (price per kilogram, liter, meter, etc.) is what makes cross-pack and cross-seller comparison possible, and EU price-indication rules require it for covered products. This skill reviews unit-price displays for consistency and clarity. Findings are review flags; which product categories are covered is a legal question to flag, not assume.

## Watch for
- Missing unit price where the selling price alone cannot support comparison (varying pack sizes).
- Inconsistent measurement bases across similar products (per 100g here, per kg there) within the same listing context.
- Unit price computed from the wrong quantity (drained weight vs net weight confusion, count vs weight).
- Stale unit prices not updated when pack size or price changes.
- Typography or placement that makes the unit price effectively invisible next to the selling price.
- Mixed units across a comparison table that silently invert the ranking.
- Bundles and multipacks whose unit price is based on bundle count rather than a standard measure.
- Rounding that distorts comparison at small unit values.

## Best practices
- Require one standard measurement unit per product category, applied uniformly across listings and comparison views.
- Verify the unit price derives from the declared quantity and recompute it in tests.
- Check display proximity and legibility: the unit price must be unambiguous and easily identifiable.
- For multipacks/bundles, state explicitly what the unit refers to (per item, per 100g of total).
- Add automated checks that unit price ≈ selling price ÷ quantity within rounding tolerance.
- Ensure unit prices refresh atomically with price or pack-size changes.
- Confirm comparison and sort features use a normalized unit so rankings are truthful.
- Flag categories where coverage rules apply (food, detergents, cosmetics, etc.) for counsel confirmation.

## Quick checklist
- [ ] Unit price present wherever pack sizes vary.
- [ ] One standard unit per category, applied uniformly.
- [ ] Unit price recomputed correctly from declared quantity.
- [ ] Display legible and unambiguous next to selling price.
- [ ] Multipack/bundle basis explicitly stated.
- [ ] Automated consistency check in place.
- [ ] Updates atomic with price/pack changes.
- [ ] Comparison features use normalized units.
