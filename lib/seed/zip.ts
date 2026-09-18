import { inflateRawSync } from "node:zlib";

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/**
 * Unpacks a zip archive by walking its central directory.
 *
 * An .xlsx is a zip of XML parts, so reading one needs nothing more than this:
 * the entries are either stored or deflated, which `node:zlib` handles.
 */
export function readZip(archive: Buffer): Map<string, Buffer> {
  let end = -1;
  for (let i = archive.length - 22; i >= 0; i--) {
    if (archive.readUInt32LE(i) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error("Not a zip archive (no end-of-central-directory record).");
  }

  const entryCount = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();

  for (let entry = 0; entry < entryCount; entry++) {
    if (archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Corrupt zip central directory.");
    }

    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.toString("utf8", offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and carries its own extra field, whose
    // length need not match the one in the central directory.
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(start, start + compressedSize);

    if (method === 0) {
      entries.set(name, data);
    } else if (method === 8) {
      entries.set(name, inflateRawSync(data));
    } else {
      throw new Error(`Unsupported zip compression method ${method} for ${name}.`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}
