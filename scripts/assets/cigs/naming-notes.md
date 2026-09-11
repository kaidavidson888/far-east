# Cigarette pack naming — collisions and mislabels

Findings from auditing the 282 supplied images against `menu-list.txt`.
Every judgement here was made by reading what is printed on the pack, at
4x, not by guessing from the file name. Nothing in this file is applied
automatically; it is the record behind `DUPLICATES` and `HAND_CROP` in
`scripts/build-cigs.mjs`, and the to-do list for renaming.

## 1. The numbering slips by one, from 211 to 220

Ten consecutive files carry the *previous* product's name. The image in
file N is the product named at N+1, all the way along:

| file | its label says | the pack actually shows | belongs to |
|------|----------------|--------------------------|------------|
| 211 | Huanghelou — Celebration | green 南京 | 212 Nanjing — Green |
| 212 | Nanjing — Green | red 南京 | 213 Nanjing — Red |
| 213 | Nanjing — Red | yellow/gold 南京 | 214 Nanjing — Gold |
| 214 | Nanjing — Gold | pale blue, cherry blossom | 215 Nanjing — Rainflower |
| 215 | Nanjing — Rainflower | pink, cherry blossom | 216 Nanjing — Dream |
| 216 | Nanjing — Dream | white, blue stars | 217 Nanjing — 12 Stars |
| 217 | Nanjing — 12 Stars | black 白沙烟 (Baisha) | 218 Baisha — Harmony of the World |
| 218 | Baisha — Harmony of the World | 利群 Liqun | 219 Liqun — Classic Red White |
| 219 | Liqun — Classic Red White | 玉溪 Yuxi | 220 Yuxi — Red Gold |
| 220 | Yuxi — Red Gold | 中南海 EIGHT | 221 Zhongnanhai — 8 |

Two consequences:

- **Huanghelou — Celebration has no photograph.** The run starts at 211
  because the image that belonged there is absent; everything after it
  shuffled up one.
- **220 and 221 are the same product.** Both are 中南海 EIGHT, two
  slightly different shots, so once the names are corrected one of them is
  surplus.

Checked either side and elsewhere (243-249, 295-303): correctly labelled.
The slip is confined to this run.

## 2. Thirteen names used by two different packs

These are not duplicates — the packs differ — so both are kept, but two
files want the same label. Suggested names, taken from the pack itself:

| ids | what distinguishes them | suggested |
|-----|-------------------------|-----------|
| 14 / 149 | 阿诗玛 mark, teal top / "eternal love" script, navy | Eternal Love (Teal) / (Navy) |
| 20 / 218 | genuine 和天下 Baisha / **Liqun** — see §1 | fixed by the renumber |
| 66 / 188 | white pack / green pack, both "supa sawa LIME 8" | Lime (White) / Lime (Green) |
| 68 / 267 | magenta "Cigar — Red Wine Capsule" / black "Capsula" | Red Wine Cigar Capsule / Red Wine (Black) |
| 92 / 186 | gold ground / white ground | Thousand Li Landscape (Gold) / (White) |
| 190 / 198 | "ESSE Change — Ice Cream Burst" / "ESSE Ice Cream — Super Slim Capsule" | Change Ice Cream Burst / Ice Cream Super Slim |
| 207 / 223 | green ornate "1916" / cream-navy "Yellow Crane Tower 1916" pagoda | 1916 (Green) / 1916 Yellow Crane Tower |
| 213 / 237 | see §1 — 213 is really Nanjing Gold | fixed by the renumber |
| 214 / 238 | see §1 — 214 is really Nanjing Rainflower | fixed by the renumber |
| 247 / 301 | green, "120's" / white, "20 Class A" | Menthol 120s / Menthol (White) |
| 248 / 302 | red, "Filter Cigarettes", "120's" / white, "Special Blend" | Red 120s / Special Blend |
| 252 / 299 | shield crest + mountain, "Premium Blend" / K monogram, "20 Class A" | Blue Premium Blend / Blue (Class A) |
| 253 / 300 | as above in red | Red Premium Blend / Red (Class A) |

Note 92/186 also share the line with `122_Tianzi-Thousand_Li_Landscape_Slim`,
and 207/223 with `55_Huanghelou-1916_Hard_Pack` and `56_..._Soft_Pack`,
which are already distinct.

## 3. Why the duplicate list is hand-made

34 pairs were the same pack and one of each was dropped (see `DUPLICATES`).
A perceptual hash could not make that call: two shots of one pack differ
more than two similar packs do, so the distances overlap completely.

- Guiyan Essence measured 98 apart — same pack
- Black Jack Grapefruit measured 27 — same pack
- ESSE Ice Cream measured 95 — two different products

A global sweep at distance ≤ 12 found no identical images hiding under
unrelated names, so the only duplication left is the 220/221 pair above,
which only becomes visible once §1 is corrected.
