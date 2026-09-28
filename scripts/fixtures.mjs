/**
 * Fetch the demonstration photographs from Wikimedia Commons and normalize
 * them to what validators read: a JFIF-headed JPEG under the contract's
 * 400,000-byte cap. Commons serves the width asked for; a JFIF APP0 segment
 * is inserted after the start-of-image marker when the file lacks one, and
 * every other byte is left as the photographer's. See fixtures/ATTRIBUTION.md.
 *
 *   node scripts/fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 400_000;
const APP0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
                          0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
const UA = { "user-agent": "OccurraFixtures/1.0 (build)" };

export const FILES = [
  { name: "ceiling-stain", title: "File:Ceiling water damage.jpg" },
  { name: "trap-leak", title: "File:Leaking PVC Pipe Under Sink - P Trap (52842956605).jpg" },
  { name: "sedan-side", title: "File:Moscow, Smolenskaya Square, rear-end collision, June 2026 07.jpg" },
  { name: "sedan-rear", title: "File:Moscow, Smolenskaya Square, rear-end collision, June 2026 06.jpg" },
  { name: "red-sedan-front", title: "File:2000 Chrysler Cirrus with missing bumper.jpg" },
  { name: "burnt-hatchback", title: "File:Burnt out Vauxhall Corsa in Middleton, Leeds.jpg" },
];
const WIDTHS = [1280, 1024, 800, 640];

function jfif(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a JPEG");
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf.subarray(6, 11).toString("latin1") === "JFIF\0") return buf;
  return Buffer.concat([buf.subarray(0, 2), APP0, buf.subarray(2)]);
}

async function thumb(title, width) {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url"
    + `&iiurlwidth=${width}&titles=${encodeURIComponent(title)}`;
  const data = await (await fetch(api, { headers: UA })).json();
  const page = Object.values(data.query.pages)[0];
  return page.imageinfo[0].thumburl;
}

const out = fileURLToPath(new URL("../fixtures/images/", import.meta.url));
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  let saved = false;
  for (const width of WIDTHS) {
    const url = await thumb(f.title, width);
    const bytes = jfif(Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer()));
    if (bytes.length <= MAX_BYTES) {
      writeFileSync(`${out}${f.name}.jpg`, bytes);
      console.log(`${f.name}.jpg  ${width}px  ${bytes.length} bytes`);
      saved = true;
      break;
    }
    console.log(`${f.name}: ${width}px is ${bytes.length} bytes, trying smaller`);
  }
  if (!saved) throw new Error(`${f.name}: no width fits under ${MAX_BYTES} bytes`);
}
