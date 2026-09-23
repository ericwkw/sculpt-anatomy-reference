// Model registry. Each entry = one subject with swappable anatomy layers.
//
// Layer .glb files live in /public/models/. Every layer carries the credit for
// its source model: title, author, licence and link. These licences are CC-BY,
// which requires the credit to stay visible wherever the work is shown, so the
// credits screen renders straight from this list rather than a separate copy
// that could drift. ATTRIBUTION.md mirrors it for anyone reading the repo.
//
// Mobile budget: keep each .glb under ~300k triangles or iPhone Safari stutters.
// Run `npm run optimize` on anything heavier.

const sketchfab = (uid) => `https://sketchfab.com/3d-models/${uid}`;
const zenodo = (id) => `https://zenodo.org/records/${id}`;

const CC_BY = "CC BY 4.0";
// Non-commercial. Fine for personal studio reference, not for anything published.
const CC_BY_NC_SA = "CC BY-NC-SA 4.0";
const CC0 = "CC0";

export const MODELS = [
  {
    id: "skull",
    label: "Skull — proportions & landmarks",
    layers: [
      {
        key: "planes",
        label: "Planes",
        src: "/models/skull-proportions.glb",
        credit: {
          title: "Skull Proportions & Key Landmarks",
          author: "Velicsek Artistic Anatomy",
          licence: CC_BY,
          url: sketchfab("20c0f43e3778481c830978709d784681"),
        },
      },
      {
        key: "male",
        label: "Male",
        src: "/models/skull-male.glb",
        credit: {
          title: "Human Male Skull",
          author: "Ruslan Gadzhiev",
          licence: CC_BY,
          url: sketchfab("f1eaaef50e5845c796d6834fd1b702e5"),
        },
      },
      {
        key: "female",
        label: "Female",
        src: "/models/skull-female.glb",
        credit: {
          title: "Human Female Skull",
          author: "Ruslan Gadzhiev",
          licence: CC_BY,
          url: sketchfab("0993a850d20d49ffb2a7add7855d2437"),
        },
      },
    ],
  },
  {
    id: "head",
    label: "Head — écorché",
    layers: [
      {
        key: "muscle-m",
        label: "Muscle ♂",
        src: "/models/head-male-muscle.glb",
        credit: {
          title: "Male Facial-muscles Ecorche",
          author: "hangar79",
          licence: CC_BY,
          url: sketchfab("23c2d4af8088418d8b3ea9057ec88ff4"),
        },
      },
      {
        key: "muscle-f",
        label: "Muscle ♀",
        src: "/models/head-female-muscle.glb",
        credit: {
          title: "Female Ecorshe_head",
          author: "SA Anatomy",
          licence: CC_BY,
          url: sketchfab("90fca6e2ea25473bbc4cdc048a79fb18"),
        },
      },
      {
        key: "skull",
        label: "Skull",
        src: "/models/skull-male.glb",
        credit: {
          title: "Human Male Skull",
          author: "Ruslan Gadzhiev",
          licence: CC_BY,
          url: sketchfab("f1eaaef50e5845c796d6834fd1b702e5"),
        },
      },
    ],
  },
  {
    id: "female-body",
    label: "Female body — CheRa (matched layers)",
    layers: [
      {
        key: "muscle",
        label: "Muscle",
        src: "/models/female-chera-muscle.glb",
        credit: {
          title: "Female Anatomy by CheRa_Muscles",
          author: "CheRa",
          licence: CC_BY,
          url: sketchfab("132188d5be9b47eabb0e64b378d81603"),
        },
      },
      {
        key: "bone",
        label: "Bone",
        src: "/models/female-chera-bone.glb",
        credit: {
          title: "Female Anatomy by CheRa_Вones",
          author: "CheRa",
          licence: CC_BY,
          url: sketchfab("dd376be43a714174b9943294f31c356d"),
        },
      },
    ],
  },
  {
    id: "female-body-lite",
    label: "Female body — lightweight",
    layers: [
      {
        key: "muscle",
        label: "Muscle",
        src: "/models/female-lite-muscle.glb",
        credit: {
          title: "Female Body Muscular System - Anatomy Study",
          author: "Ruslan Gadzhiev",
          licence: CC_BY,
          url: sketchfab("9a596b6c24b344bfbe6bb5246290df0e"),
        },
      },
      {
        key: "skeleton",
        label: "Skeleton",
        src: "/models/female-lite-skeleton.glb",
        credit: {
          title: "Female Human Skeleton - ZBrush - Anatomy Study",
          author: "Ruslan Gadzhiev",
          licence: CC_BY,
          url: sketchfab("5f28b52cab3e439490727e0aede55a6b"),
        },
      },
    ],
  },
  {
    id: "ecorche-casts",
    label: "Écorché casts — scanned",
    layers: [
      {
        key: "houdon",
        label: "Houdon figure",
        src: "/models/houdon-ecorche.glb",
        credit: {
          title: "Flayed Man at The Louvre, Paris (Jean-Antoine Houdon)",
          author: "Scan the World",
          licence: CC_BY_NC_SA,
          url: zenodo(21680445),
        },
      },
      {
        key: "bust",
        label: "Écorché bust",
        src: "/models/ecorche-bust.glb",
        credit: {
          title: "Ecorché Bust statue scan",
          author: "Scan the World",
          licence: "CC BY-NC-SA 2.0",
          url: zenodo(10388555),
        },
      },
    ],
  },
  {
    id: "female-casts",
    label: "Female figure — scanned sculpture",
    layers: [
      {
        key: "capitoline",
        label: "Capitoline Venus",
        src: "/models/capitoline-venus.glb",
        credit: {
          title: "Capitoline Venus at The Louvre, Paris",
          author: "Scan the World",
          licence: CC_BY_NC_SA,
          url: zenodo(21248324),
        },
      },
      {
        key: "amazon",
        label: "Wounded Amazon",
        src: "/models/wounded-amazon.glb",
        credit: {
          title: "Torso of a Wounded Amazon",
          author: "Scan the World",
          licence: CC_BY_NC_SA,
          url: zenodo(21671483),
        },
      },
      {
        key: "kore",
        label: "Kore torso",
        src: "/models/female-torso.glb",
        credit: {
          title: "Female torso",
          author: "Scan the World",
          licence: CC_BY_NC_SA,
          url: zenodo(20169300),
        },
      },
      {
        key: "venus-italica",
        label: "Venus Italica",
        src: "/models/venus-italica-bust.glb",
        credit: {
          title: "Venus Italica, Bust (Antonio Canova)",
          author: "Scan the World",
          licence: CC0,
          url: zenodo(22010305),
        },
      },
    ],
  },
];

/** One entry per source model, de-duplicated — some are reused across subjects. */
export function listCredits() {
  const seen = new Map();
  for (const model of MODELS) {
    for (const layer of model.layers) {
      if (!seen.has(layer.credit.url)) seen.set(layer.credit.url, layer.credit);
    }
  }
  return [...seen.values()];
}
