import { team, formation } from "./domain.js";
const asset = (n) => `${process.env.PUBLIC_URL || ""}/assets/${n}.png`;
function load(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}
export async function shareFormation(match, players, profiles) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1250;
  const c = canvas.getContext("2d");
  c.fillStyle = "#0d0f12";
  c.fillRect(0, 0, 900, 1250);
  const logo = await load(asset("oslava_escudo"));
  if (logo) c.drawImage(logo, 30, 20, 115, 115);
  c.fillStyle = "#ffd12f";
  c.font = "bold 42px Arial";
  c.fillText("OSLAVA FC", 165, 67);
  c.fillStyle = "#fff";
  c.font = "22px Arial";
  c.fillText(`${match.fecha} · ${match.hora} hs`, 165, 105);
  c.fillStyle = "#205b3b";
  c.fillRect(30, 155, 840, 1000);
  c.strokeStyle = "#b2d4b0";
  c.lineWidth = 3;
  c.strokeRect(45, 170, 810, 970);
  c.beginPath();
  c.moveTo(45, 655);
  c.lineTo(855, 655);
  c.stroke();
  c.beginPath();
  c.arc(450, 655, 90, 0, Math.PI * 2);
  c.stroke();
  c.strokeRect(240, 170, 420, 145);
  c.strokeRect(240, 995, 420, 145);
  for (const t of ["verde", "blanco"]) {
    const keeper = match[t === "verde" ? "arqueroVerdeId" : "arqueroBlancoId"];
    const ps = formation(
      [...team(match[t])].sort(
        (a, b) => Number(b.id === keeper) - Number(a.id === keeper),
      ),
      t === "verde",
    );
    for (const p of ps) {
      const x = 30 + p.x * 840,
        y = 155 + p.y * 1000;
      const current = players.find((a) => a.id === p.id) || p,
        profile = profiles[current.usuarioUid] || {},
        photo = profile.fotoData || profile.fotoUrl || p.fotoUrl,
        code = profile.avatar || p.emoji || "AV01";
      const url = photo
        ? photo.startsWith("http") || photo.startsWith("data:")
          ? photo
          : `data:image/jpeg;base64,${photo}`
        : /^AV\d{2}$/.test(code)
          ? asset(`oslava_avatar_${code.slice(2)}`)
          : asset("oslava_avatar_01");
      const image = await load(url);
      c.fillStyle = t === "verde" ? "#233b2c" : "#f5fcff";
      c.fillRect(x - 27, y - 15, 54, 47);
      c.fillStyle = t === "verde" ? "#ffd12f" : "#45cfcc";
      c.fillRect(x + (t === "verde" ? 12 : -24), y - 15, 6, 47);
      if (image) {
        c.save();
        c.beginPath();
        c.arc(x, y - 22, 25, 0, Math.PI * 2);
        c.clip();
        c.drawImage(image, x - 25, y - 47, 50, 50);
        c.restore();
      }
      c.font = "bold 17px Arial";
      c.textAlign = "center";
      const name = current.nombre || p.nombre;
      c.fillStyle = "#123321";
      c.fillRect(x - 88, y + 35, 176, 28);
      c.fillStyle = "#fff";
      c.fillText(name.length > 18 ? name.slice(0, 17) + "…" : name, x, y + 55);
    }
  }
  c.textAlign = "center";
  c.fillStyle = "#d7af72";
  c.font = "bold 22px Arial";
  c.fillText("EL POTRERO TIENE SU APP", 450, 1210);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw Error("No se pudo crear la imagen.");
  const file = new File([blob], "oslava-formacion.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Formación Oslava FC", files: [file] });
  } else {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
