// Model registry. Each entry = one subject with swappable anatomy layers.
//
// Layer .glb files live in /public/models/. Download sources + licences are
// tracked in ATTRIBUTION.md at the repo root — keep that file in sync, the
// CC-BY licences require visible credit.
//
// Mobile budget: keep each .glb under ~300k triangles or iPhone Safari stutters.
// Decimate heavier meshes in Blender before exporting (see README).

export const MODELS = [
  {
    id: "skull",
    label: "Skull — proportions & landmarks",
    layers: [
      { key: "planes", label: "Planes", src: "/models/skull-proportions.glb" },
      { key: "male", label: "Male", src: "/models/skull-male.glb" },
      { key: "female", label: "Female", src: "/models/skull-female.glb" },
    ],
  },
  {
    id: "head",
    label: "Head — écorché",
    layers: [
      { key: "muscle-m", label: "Muscle ♂", src: "/models/head-male-muscle.glb" },
      { key: "muscle-f", label: "Muscle ♀", src: "/models/head-female-muscle.glb" },
      { key: "skull", label: "Skull", src: "/models/skull-male.glb" },
    ],
  },
  {
    id: "female-body",
    label: "Female body — CheRa (matched layers)",
    layers: [
      { key: "muscle", label: "Muscle", src: "/models/female-chera-muscle.glb" },
      { key: "bone", label: "Bone", src: "/models/female-chera-bone.glb" },
    ],
  },
  {
    id: "female-body-lite",
    label: "Female body — lightweight",
    layers: [
      { key: "muscle", label: "Muscle", src: "/models/female-lite-muscle.glb" },
      { key: "skeleton", label: "Skeleton", src: "/models/female-lite-skeleton.glb" },
    ],
  },
];
