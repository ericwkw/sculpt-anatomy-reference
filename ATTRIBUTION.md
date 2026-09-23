# Model Attribution

All models below are used under Creative Commons licences. CC Attribution (CC-BY)
requires that the author credit stays visible wherever the model is shown, so this
file must be kept in sync with `src/models.js`.

Download each from Sketchfab (free account required), then export/convert to `.glb`
and save it under `models-raw/` with the filename listed in the "Save as"
column. Run `npm run optimize` afterwards to decimate them for phone use.

## Skull

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Skull Proportions & Key Landmarks](https://sketchfab.com/3d-models/20c0f43e3778481c830978709d784681) | Velicsek Artistic Anatomy | CC-BY | 39k | `skull-proportions.glb` |
| [Human Male Skull](https://sketchfab.com/3d-models/f1eaaef50e5845c796d6834fd1b702e5) | Ruslan Gadzhiev | CC-BY | 137k | `skull-male.glb` |
| [Human Female Skull](https://sketchfab.com/3d-models/0993a850d20d49ffb2a7add7855d2437) | Ruslan Gadzhiev | CC-BY | 137k | `skull-female.glb` |

## Head — écorché

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Male Facial-muscles Ecorche](https://sketchfab.com/3d-models/23c2d4af8088418d8b3ea9057ec88ff4) | hangar79 | CC-BY | 620k | `head-male-muscle.glb` |
| [Female Ecorshe_head](https://sketchfab.com/3d-models/90fca6e2ea25473bbc4cdc048a79fb18) | SA Anatomy | CC-BY | 1.9M | `head-female-muscle.glb` |

Both are well over the phone budget — `npm run optimize` handles them.

## Female body — CheRa (matched layers)

Same base body sculpted in both muscle and bone passes, so the two layers line up
when you toggle between them. The best pairing found.

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Female Anatomy by CheRa_Muscles](https://sketchfab.com/3d-models/132188d5be9b47eabb0e64b378d81603) | CheRa | CC-BY | 864k | `female-chera-muscle.glb` |
| [Female Anatomy by CheRa_Вones](https://sketchfab.com/3d-models/dd376be43a714174b9943294f31c356d) | CheRa | CC-BY | 510k | `female-chera-bone.glb` |

## Female body — lightweight

Lower poly, runs smoothly on phone without decimating.

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Female Body Muscular System](https://sketchfab.com/3d-models/9a596b6c24b344bfbe6bb5246290df0e) | Ruslan Gadzhiev | CC-BY | 251k | `female-lite-muscle.glb` |
| [Female Human Skeleton](https://sketchfab.com/3d-models/5f28b52cab3e439490727e0aede55a6b) | Ruslan Gadzhiev | CC-BY | 97k | `female-lite-skeleton.glb` |

## Other candidates

Not wired into the app, but worth a look:

| Model | Author | Licence | Tris | Note |
|---|---|---|---|---|
| [Female Body – Skeleton, Muscles & Base Mesh](https://sketchfab.com/3d-models/d415a87cbd2142e78cc4fc5ad592fd39) | BALENSOVA | CC-BY-**NC** | 475k | All three layers in one file |
| [Ecorche - Anatomy study](https://sketchfab.com/3d-models/e402d3d541eb4b199c57d5410f5d3c57) | Beatriz Gomez Santamaria | CC-BY | 419k | Full body écorché |
| [Female muscles base mesh](https://sketchfab.com/3d-models/abd8ccef6aeb42058601c192aadb8198) | horanbeckman | CC-BY | 130k | Simplified, light |
| [ECORCHÈ HEAD STUDY](https://sketchfab.com/3d-models/160bb59de678411a88ba2113cfbf3e75) | Alejandro.Planas | CC-BY | 512k | Head écorché |
| [Human Male Écorché for drawing reference](https://sketchfab.com/3d-models/6f42cbcfab894a98b8b8df181b98b1e3) | Mathieu Vaillancourt | CC-BY | 1.25M | Built for artists |
| [Head and Neck Anatomy for Dentistry](https://sketchfab.com/3d-models/76e6bdbfd39f40dbab847ba7c382ad60) | University of Dundee, CAHID | CC-BY | 1.33M | Medically accurate |

## Licence notes

- **CC-BY** — free to use anywhere, including commercially, as long as the author is credited.
- **CC-BY-NC** — personal studio reference only. Do not use in anything you sell.
- Avoid **ND** (NoDerivatives) models here: decimating or converting them counts as a
  derivative, which the licence forbids.

## Non-Sketchfab alternatives

- **[Z-Anatomy](https://www.z-anatomy.com/)** — full open-source human atlas, CC-BY-SA,
  every structure named and separable. Heaviest option but by far the most complete.
- **[BodyParts3D](https://lifesciencedb.jp/bp3d/)** — CC-BY-SA anatomy database from
  the University of Tokyo, per-organ mesh downloads.
