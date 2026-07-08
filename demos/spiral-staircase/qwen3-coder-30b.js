for (let i = 0; i < 32; i++) {
  const angle = i * 0.4;
  const x = 32 + Math.floor(Math.cos(angle) * 10);
  const z = 32 + Math.floor(Math.sin(angle) * 10);
  place(x, i, z, "wood");
  place(x + 1, i, z, "wood");
  place(x, i, z + 1, "wood");
  place(x + 1, i, z + 1, "wood");
}
