'use strict';

// Minimal ZIP reader (stored and deflate entries, UTF-8 names).
const ZipReader = (() => {
  const decoder = new TextDecoder('utf-8');

  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Returns [{ name, data(): Promise<Uint8Array> }]; throws Error with a readable message.
  function read(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Tai nėra ZIP failas arba jis sugadintas');

    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const entries = [];
    for (let n = 0; n < count; n++) {
      if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP failo struktūra sugadinta');
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localOffset = view.getUint32(p + 42, true);
      const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue; // folder entry

      entries.push({
        name,
        data: async () => {
          if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('ZIP failo struktūra sugadinta');
          const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
          const raw = bytes.subarray(start, start + compSize);
          if (method === 0) return raw;
          if (method === 8) return inflateRaw(raw);
          throw new Error(`Nepalaikomas ZIP suspaudimo būdas (${method})`);
        },
      });
    }
    return entries;
  }

  return { read };
})();
