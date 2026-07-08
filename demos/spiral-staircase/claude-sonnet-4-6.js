box(31, 0, 31, 2, 40, 2, "stone");
for (let i = 0; i < 40; i++) {
  const angle = i * 0.5;
  const x = 32 + Math.floor(Math.cos(angle) * 8);
  const z = 32 + Math.floor(Math.sin(angle) * 8);
  box(x, i, z, 2, 1, 2, "wood");
}
