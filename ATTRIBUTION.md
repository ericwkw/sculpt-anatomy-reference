# Model Attribution

All models below are used under Creative Commons licences. CC Attribution (CC-BY)
requires that the author credit stays visible wherever the model is shown, so this
file must be kept in sync with `src/models.js`.

> **This project is personal-use only.** Several of the scanned sculptures are
> **NonCommercial**, which is fine for private studio reference but rules out
> publishing, deploying publicly, or anything commercial. If that ever changes,
> every NC model below has to come out first.

Download each from Sketchfab (free account required), then export/convert to `.glb`
and save it under `models-raw/` with the filename listed in the "Save as"
column. Run `npm run optimize` afterwards to decimate them for phone use.

## Skull

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Skull Proportions & Key Landmarks](https://sketchfab.com/3d-models/20c0f43e3778481c830978709d784681) | Velicsek Artistic Anatomy | CC-BY | 39k | `skull-proportions.glb` |
| [Human Male Skull](https://sketchfab.com/3d-models/f1eaaef50e5845c796d6834fd1b702e5) | Ruslan Gadzhiev | CC-BY | 137k | `skull-male.glb` |
| [Human Female Skull](https://sketchfab.com/3d-models/0993a850d20d49ffb2a7add7855d2437) | Ruslan Gadzhiev | CC-BY | 137k | `skull-female.glb` |
| [Open 3D Model — exploded view skull](https://anatomytool.org/content/open3dmodel-exploded-view-skull-english-labels) | AnatomyTool Open 3D Model | CC-BY-SA 4.0 | 192k | `skull-exploded.glb` |

The exploded skull separates all 29 named bones — useful for seeing where the nasal
bone ends, how maxilla meets zygomatic, and how the mandible hangs. Download the
**GLB** zip from [the source files page](https://anatomytool.org/open3dmodel-create)
and rename the `.glb` inside it.

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

## Head — photogrammetry scan

A real person, not a sculpted interpretation. The geometry is only ~25k triangles —
the realism is in the albedo and normal maps, not the mesh.

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Free HD Female Head Scan](https://www.3dscanstore.com/blog/Free-3D-Head-Model) | 3D Scan Store / Ten24 | **Personal use only** | 31k | `head-scan-female.glb` |

The download is a 2 GB zip, mostly a ZBrush file and 8K TGA maps that this project does
not need. Take these into `models-raw/head-scan/`:

- `OBJ/Head.obj`
- `OBJ/Realtime Eyeball Left.obj` and `Realtime Eyeball Right.obj`
- `Textures/JPG/Face/Face_Albedo.jpg` and `Face_Normal.jpg`
- `Textures/JPG/Eyes/Eyes_Balls_Diffuse.jpg`

The archive ships no `.mtl` files even though every OBJ references one, so the three in
`models-raw/head-scan/` are written by hand. Keep them.

The head and both eyeballs are separate meshes, so they are merged into one file before
the optimizer runs:

```sh
node scripts/merge-obj.mjs models-raw/head-scan-female.glb models-raw/head-scan/*.obj
```

Teeth, tongue, brows and lashes are also in the archive and are left out — hair
reconstructs badly and is noise for sculpting reference.

## Écorché casts — scanned sculpture

Photogrammetry of real museum objects by [Scan the World](https://www.myminifactory.com/scantheworld/),
archived on Zenodo. Downloads are `.glb` already — no Blender step. Take the
`_normalized.glb` file from each record for full resolution.

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Flayed Man at The Louvre (Houdon)](https://zenodo.org/records/21680445) | Scan the World | CC-BY-**NC**-SA 4.0 | 307k | `houdon-ecorche.glb` |
| [Ecorché Bust statue scan](https://zenodo.org/records/10388555) | Scan the World | CC-BY-**NC**-SA 2.0 | 100k | `ecorche-bust.glb` |

## Female figure — scanned sculpture

| Model | Author | Licence | Tris | Save as |
|---|---|---|---|---|
| [Capitoline Venus at The Louvre](https://zenodo.org/records/21248324) | Scan the World | CC-BY-**NC**-SA 4.0 | 400k | `capitoline-venus.glb` |
| [Torso of a Wounded Amazon](https://zenodo.org/records/21671483) | Scan the World | CC-BY-**NC**-SA 4.0 | 990k | `wounded-amazon.glb` |
| [Female torso (kore)](https://zenodo.org/records/20169300) | Scan the World | CC-BY-**NC**-SA 4.0 | 655k | `female-torso.glb` |
| [Venus Italica, Bust (Canova)](https://zenodo.org/records/22010305) | Scan the World | **CC0** | 2.0M | `venus-italica-bust.glb` |

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

- **CC0** — public domain, no conditions at all.
- **CC-BY** — free to use anywhere, including commercially, as long as the author is credited.
- **CC-BY-NC / CC-BY-NC-SA** — personal studio reference only. Do not use in anything you
  sell, publish, or deploy publicly. Most of the scanned sculptures are in this category.
- Avoid **ND** (NoDerivatives) models here: decimating or converting them counts as a
  derivative, which the licence forbids.

## Non-Sketchfab alternatives

- **[Z-Anatomy](https://www.z-anatomy.com/)** — full open-source human atlas, CC-BY-SA,
  every structure named and separable. Heaviest option but by far the most complete.
- **[BodyParts3D](https://lifesciencedb.jp/bp3d/)** — CC-BY-SA anatomy database from
  the University of Tokyo, per-organ mesh downloads.
