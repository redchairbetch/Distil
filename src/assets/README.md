# Asset Directory — Distil Device Imagery

Drop image files into the folders below. Use **PNG** (preferred) or **SVG**.
File names must match the IDs/keys used in the code exactly.

---

## body-styles/
One image per body style. Name must match the `id` from BODY_STYLES:

```
ric.png       ← RIC / miniRITE
bte.png       ← BTE (Behind-the-ear)
ite.png       ← ITE (In-the-ear, full shell)
itc.png       ← ITC (In-the-canal, half shell)
cic.png       ← CIC (Completely-in-canal)
iic.png       ← IIC (Invisible-in-canal)
```

Ideal size: 200x200px transparent PNG. Side-profile or 3/4 view.

---

## logos/
One logo per manufacturer. Name must match the manufacturer string
exactly as it appears in the catalog (lowercase, hyphens for spaces):

```
oticon.png
phonak.png
resound.png
rexton.png
signia.png
starkey.png
widex.png
truhearing.png
unitron.png       ← if needed later
```

Ideal size: 200x80px transparent PNG or SVG. Horizontal/wordmark preferred.

---

## receivers/
Receiver images, organized by manufacturer. Name format:
`{manufacturer}-{power}.png`

```
signia-s.png      ← Standard receiver
signia-m.png      ← Medium
signia-p.png      ← Power
signia-hp.png     ← High Power (earmold)
oticon-60.png     ← 60 Gain
oticon-85.png     ← 85 Gain
oticon-100.png    ← 100 Gain
oticon-105.png    ← 105 Gain (earmold)
phonak-s.png
phonak-m.png
phonak-p.png
phonak-hp.png
resound-lp.png    ← Low Power
resound-mp.png    ← Medium Power
resound-hp.png    ← High Power
resound-up.png    ← Ultra Power (earmold)
truhearing-s.png  ← 110/46 (S)
truhearing-m.png  ← 119/60 (M)
truhearing-p.png  ← 122/65 (P)
truhearing-hp.png ← 131/75 (HP, earmold)
```

Ideal size: 150x150px transparent PNG.

---

## domes/
Dome images. Name format: `{type}.png` or `{manufacturer}-{type}.png`

Generic domes (shared across brands):
```
open.png
tulip.png
vented.png
closed.png
power.png
earmold.png
```

Or manufacturer-specific if they look different:
```
signia-open.png
signia-closed.png
oticon-open.png
phonak-open.png
```

Ideal size: 120x120px transparent PNG.
