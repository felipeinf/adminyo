export function rowHasKeyCaseInsensitive(
  row: Record<string, unknown>,
  field: string,
): boolean {
  if (Object.prototype.hasOwnProperty.call(row, field)) return true;
  const lower = field.toLowerCase();
  return Object.keys(row).some((k) => k.toLowerCase() === lower);
}

function normalizePathSegment(seg: string): string {
  const t = seg.trim();
  if (t.toLowerCase() === "indentity") {
    return "identity";
  }
  return t;
}

function getChildCaseInsensitive(
  obj: Record<string, unknown>,
  seg: string,
): unknown {
  const raw = seg.trim();
  const logical = normalizePathSegment(seg);
  const tryKeys = raw === logical ? [raw] : [raw, logical];
  for (const k of tryKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      return obj[k];
    }
  }
  for (const k of tryKeys) {
    const lower = k.toLowerCase();
    const found = Object.keys(obj).find((key) => key.toLowerCase() === lower);
    if (found !== undefined) {
      return obj[found];
    }
  }
  return undefined;
}

function navigateDataPath(data: unknown, path: string | null | undefined): unknown {
  const trimmed = path?.trim();
  if (!trimmed) return data;
  let cur: unknown = data;
  for (const seg of trimmed
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return undefined;
    }
    const next = getChildCaseInsensitive(cur as Record<string, unknown>, seg);
    if (next === undefined) return undefined;
    cur = next;
  }
  return cur;
}

function mapItemToTableRow(
  row: Record<string, unknown>,
  rowPath: string | null | undefined,
  idField: string | null | undefined,
): Record<string, unknown> {
  const idKey = idField?.trim() || "id";
  if (!rowPath?.trim()) return row;
  const inner = navigateDataPath(row, rowPath);
  if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
    const out = { ...(inner as Record<string, unknown>) };
    if (row[idKey] !== undefined && out[idKey] === undefined) {
      out[idKey] = row[idKey];
    }
    return out;
  }
  return row;
}

function rowsFromValue(inner: unknown): Record<string, unknown>[] {
  if (Array.isArray(inner)) {
    return inner.filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === "object" && !Array.isArray(x),
    );
  }
  if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
    return [inner as Record<string, unknown>];
  }
  if (inner !== null && typeof inner === "object") {
    for (const v of Object.values(inner as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length > 0) {
        const first = v[0];
        if (first !== null && typeof first === "object" && !Array.isArray(first)) {
          return v as Record<string, unknown>[];
        }
      }
    }
  }
  return [];
}

export function extractRows(
  data: unknown,
  dataPath?: string | null,
  rowPath?: string | null,
  idField?: string | null,
): Record<string, unknown>[] {
  const inner = navigateDataPath(data, dataPath);
  if (dataPath?.trim() && inner === undefined) {
    return [];
  }
  return rowsFromValue(inner).map((r) => mapItemToTableRow(r, rowPath, idField));
}

export function isAdminyoUnauthorized(status: number, body: unknown): boolean {
  if (status !== 401) return false;
  if (!body || typeof body !== "object") return false;
  const s = (body as { source?: string }).source;
  return s === "adminyo";
}
