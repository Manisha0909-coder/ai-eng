/**
 * Access-graph tree model.
 *
 * Turns the RBAC API's nested user shape
 *   roles[] → personas[] → tool_tags[] / document_tags[] → tool_names[]
 * into a uniform, depth-tagged tree the drawer can render and step through.
 *
 * The single-user detail endpoint (GET /users/{id}) returns roles as objects
 * with the nested personas/tags inline; list rows often carry only role-name
 * strings. `buildAccessTree` tolerates both — a string role just becomes a
 * childless ROLE node — so the drawer degrades gracefully instead of throwing.
 */

export type AccessNodeType =
  | "root"
  | "role"
  | "persona"
  | "tool_tag"
  | "doc_tag"
  | "tool";

export interface AccessNode {
  /** Stable, path-derived key (unique within a tree). */
  key: string;
  type: AccessNodeType;
  /** Primary label (rendered prominently). */
  name: string;
  /** Human description shown right after the name (e.g. a role's description). */
  desc?: string;
  /** Dim secondary count/summary shown after the description. */
  meta?: string;
  /** A small "vN" style pill (personas only, for now). */
  version?: string | null;
  /** Mono sub-label, e.g. a persona's model id. */
  model?: string | null;
  /** Doc tags granted directly by the role (vs. via a persona). */
  grantedByRole?: boolean;
  /**
   * How many distinct paths in the tree reach a doc tag of this name. Renders
   * as a "× N paths" pill when > 1 (the same doc set reachable two ways).
   */
  pathCount?: number;
  children: AccessNode[];
}

export interface AccessSummary {
  tools: number;
  roles: number;
  personas: number;
  docTags: number;
  toolTags: number;
}

/** Coerce a possibly-string / possibly-object entity to a display name. */
function nameOf(x: any, ...keys: string[]): string {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return String(x);
  for (const k of keys) if (x[k] != null) return String(x[k]);
  return String(x.id ?? "");
}

const isObj = (x: any): x is Record<string, any> =>
  x != null && typeof x === "object";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------------------------------------------------------------------------
 *  Reference enrichment.
 *
 *  The user-detail endpoint returns roles/personas/tags as a union of full
 *  objects OR bare ids/names (`Array<Persona | number | string>`). To render
 *  the full hierarchy we resolve every reference to the richest object we have,
 *  using lookups built from the roles / personas / tool-tags / doc-tags lists.
 *  When the data already arrives fully nested (or no lookups are supplied),
 *  enrichment is a safe pass-through.
 * ------------------------------------------------------------------------- */

export interface AccessLookups {
  roles: Map<string, any>;
  personas: Map<string, any>;
  tags: Map<string, any>;
  docTags: Map<string, any>;
}

/** Index a list by `#id` and by each of the given name fields. */
function indexBy(items: any[], nameFields: string[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const it of items ?? []) {
    if (!isObj(it)) continue;
    if (it.id != null) map.set(`#${it.id}`, it);
    for (const f of nameFields) {
      if (it[f] != null && !map.has(String(it[f]))) map.set(String(it[f]), it);
    }
  }
  return map;
}

export function buildAccessLookups(data: {
  roles?: any[];
  personas?: any[];
  tags?: any[];
  docTags?: any[];
}): AccessLookups {
  return {
    roles: indexBy(data.roles ?? [], ["name"]),
    personas: indexBy(data.personas ?? [], ["persona_name", "name"]),
    tags: indexBy(data.tags ?? [], ["name"]),
    docTags: indexBy(data.docTags ?? [], ["name"]),
  };
}

/** Resolve a ref (id / name / object) to the richest object available. */
function resolveRef(entry: any, lookup: Map<string, any>, nameField: string): any {
  if (entry == null) return null;
  if (typeof entry === "number") return lookup.get(`#${entry}`) ?? null;
  if (typeof entry === "string") return lookup.get(entry) ?? null;
  if (isObj(entry)) {
    const byId = entry.id != null ? lookup.get(`#${entry.id}`) : undefined;
    const byName =
      entry[nameField] != null ? lookup.get(String(entry[nameField])) : undefined;
    // Prefer the canonical/complete looked-up object, else the entry itself.
    return byId ?? byName ?? entry;
  }
  return null;
}

const roleHasPersonas = (role: any): boolean =>
  isObj(role) && Array.isArray(role.personas) && role.personas.length > 0;

/**
 * Find the richest role object for a ref. A role can arrive as a bare id/name
 * (resolved via the roles lookup) or as an object on the user; when both exist
 * we prefer whichever already carries personas.
 */
export function findRoleObject(roleRef: any, lookups: AccessLookups): any | null {
  let fromLookup: any = null;
  if (typeof roleRef === "number") fromLookup = lookups.roles.get(`#${roleRef}`);
  else if (typeof roleRef === "string") fromLookup = lookups.roles.get(roleRef);
  else if (isObj(roleRef)) {
    fromLookup =
      (roleRef.id != null && lookups.roles.get(`#${roleRef.id}`)) ||
      (roleRef.name != null && lookups.roles.get(String(roleRef.name))) ||
      null;
  }
  const candidates = [isObj(roleRef) ? roleRef : null, fromLookup].filter(isObj);
  return candidates.find(roleHasPersonas) ?? candidates[0] ?? null;
}

/** True when a resolved role still has no personas → fetch its full detail. */
export function roleNeedsDetailFetch(role: any): boolean {
  return isObj(role) && !roleHasPersonas(role);
}

/** Best-effort numeric id for a role, from the resolved object or the ref. */
export function roleIdOf(roleRef: any, role: any): number | null {
  if (isObj(role) && typeof role.id === "number") return role.id;
  if (isObj(roleRef) && typeof roleRef.id === "number") return roleRef.id;
  return null;
}

/**
 * Resolve a single role's persona / doc-tag refs to full nested objects, and
 * each persona's tool-tag / doc-tag refs in turn — so the tree can render
 * personas → tags → tools even when the role hands back bare ids or names.
 */
export function enrichRole(role: any, lookups: AccessLookups): any {
  if (!isObj(role)) return role;
  const personas = (role.personas ?? []).map((pRef: any) => {
    const persona = resolveRef(pRef, lookups.personas, "persona_name");
    if (!isObj(persona)) return pRef;
    return {
      ...persona,
      tool_tags: (persona.tool_tags ?? []).map(
        (t: any) => resolveRef(t, lookups.tags, "name") ?? t
      ),
      document_tags: (persona.document_tags ?? []).map(
        (d: any) => resolveRef(d, lookups.docTags, "name") ?? d
      ),
    };
  });
  const document_tags = (role.document_tags ?? []).map(
    (d: any) => resolveRef(d, lookups.docTags, "name") ?? d
  );
  return { ...role, personas, document_tags };
}

/**
 * Build the access tree from a raw API/sample user. Pure — safe to call in a
 * `useMemo`. Doc-tag "paths" multiplicity is computed in a second pass so a tag
 * reachable via both a role and a persona shows "× 2 paths".
 */
export function buildAccessTree(user: any): AccessNode {
  const roles: AccessNode[] = (user?.roles ?? []).map((role: any, ri: number) => {
    // Plain-string role (list-row shape): render as a childless node.
    if (!isObj(role)) {
      return {
        key: `role:${role ?? ri}`,
        type: "role" as const,
        name: nameOf(role),
        meta: "role",
        children: [],
      };
    }

    const roleKey = `role:${role.id ?? ri}`;

    const personas: AccessNode[] = (role.personas ?? [])
      .filter(isObj)
      .map((p: any, pi: number) => {
        const pKey = `${roleKey}/persona:${p.id ?? pi}`;

        const toolTags: AccessNode[] = (p.tool_tags ?? [])
          .filter(isObj)
          .map((t: any, ti: number) => {
            const tKey = `${pKey}/tooltag:${t.id ?? ti}`;
            // A tool's "category" is its parent tool tag's description (e.g.
            // "core", "ms_graph") — shown as the tool's sub-label.
            const toolCategory = t.description ? String(t.description) : "tool";
            const tools: AccessNode[] = (t.tool_names ?? []).map(
              (tn: any, tj: number) => ({
                key: `${tKey}/tool:${tj}`,
                type: "tool" as const,
                name: nameOf(tn),
                meta: toolCategory,
                children: [],
              })
            );
            return {
              key: tKey,
              type: "tool_tag" as const,
              name: nameOf(t, "name"),
              meta: t.description
                ? `${plural(tools.length, "tool")} · ${t.description}`
                : plural(tools.length, "tool"),
              children: tools,
            };
          });

        const docTags: AccessNode[] = (p.document_tags ?? []).map(
          (d: any, di: number) => ({
            key: `${pKey}/doc:${nameOf(d, "name") || di}`,
            type: "doc_tag" as const,
            name: nameOf(d, "name"),
            meta: (isObj(d) && d.description) || "Document set",
            children: [],
          })
        );

        const docCount = docTags.length;
        const toolTagCount = toolTags.length;
        return {
          key: pKey,
          type: "persona" as const,
          name: nameOf(p, "persona_name", "name"),
          version: p.version != null ? `v${p.version}` : null,
          model: p.model_id ?? null,
          meta: `${plural(docCount, "tag")} · ${plural(toolTagCount, "tool set")}`,
          children: [...toolTags, ...docTags],
        };
      });

    // Doc tags granted directly by the role (shown alongside its personas).
    const roleDocTags: AccessNode[] = (role.document_tags ?? []).map(
      (d: any, di: number) => ({
        key: `${roleKey}/doc:${nameOf(d, "name") || di}`,
        type: "doc_tag" as const,
        name: nameOf(d, "name"),
        meta: (isObj(d) && d.description) || "Document set",
        grantedByRole: true,
        children: [],
      })
    );

    return {
      key: roleKey,
      type: "role" as const,
      name: nameOf(role, "name"),
      desc: role.description || undefined,
      meta: `${plural(personas.length, "persona")} · ${plural(
        roleDocTags.length,
        "direct tag"
      )}`,
      children: [...personas, ...roleDocTags],
    };
  });

  const root: AccessNode = {
    key: "root",
    type: "root",
    name: user?.user_id || "User",
    children: roles,
  };

  annotateDocTagPaths(root);
  return root;
}

/** Tag every doc-tag node with the number of same-named doc tags in the tree. */
function annotateDocTagPaths(root: AccessNode): void {
  const counts = new Map<string, number>();
  const walk = (n: AccessNode) => {
    if (n.type === "doc_tag") counts.set(n.name, (counts.get(n.name) ?? 0) + 1);
    n.children.forEach(walk);
  };
  walk(root);
  const apply = (n: AccessNode) => {
    if (n.type === "doc_tag") n.pathCount = counts.get(n.name) ?? 1;
    n.children.forEach(apply);
  };
  apply(root);
}

/**
 * De-duplicated reach counts for the "{user} can reach …" summary line. Names
 * are the natural identity for tags/tools; personas use their tree key so two
 * personas that share a name under different roles still both count.
 */
export function computeAccessSummary(root: AccessNode): AccessSummary {
  const personas = new Set<string>();
  const toolTags = new Set<string>();
  const docTags = new Set<string>();
  const tools = new Set<string>();

  const walk = (n: AccessNode) => {
    switch (n.type) {
      case "persona":
        personas.add(n.key);
        break;
      case "tool_tag":
        toolTags.add(n.name);
        break;
      case "doc_tag":
        docTags.add(n.name);
        break;
      case "tool":
        tools.add(n.name);
        break;
    }
    n.children.forEach(walk);
  };
  walk(root);

  return {
    tools: tools.size,
    roles: root.children.filter((c) => c.type === "role").length,
    personas: personas.size,
    docTags: docTags.size,
    toolTags: toolTags.size,
  };
}

export interface AccessGroupItem {
  key: string;
  name: string;
  meta?: string;
  /** Render the name in a monospace font (ids/handles vs. display names). */
  mono: boolean;
}

export interface AccessGroups {
  roles: AccessGroupItem[];
  personas: AccessGroupItem[];
  docTags: AccessGroupItem[];
  toolTags: AccessGroupItem[];
  tools: AccessGroupItem[];
}

/**
 * Flatten the tree into de-duplicated, type-grouped lists for the "Summary"
 * view — every distinct role / persona / doc tag / tool tag / tool the user can
 * reach, each with a short sub-label. First occurrence wins on a name clash.
 */
export function computeAccessGroups(root: AccessNode): AccessGroups {
  const roles = new Map<string, AccessGroupItem>();
  const personas = new Map<string, AccessGroupItem>();
  const docTags = new Map<string, AccessGroupItem>();
  const toolTags = new Map<string, AccessGroupItem>();
  const tools = new Map<string, AccessGroupItem>();

  const add = (
    map: Map<string, AccessGroupItem>,
    item: AccessGroupItem
  ): void => {
    if (item.name && !map.has(item.name)) map.set(item.name, item);
  };

  const walk = (n: AccessNode) => {
    switch (n.type) {
      case "role":
        add(roles, { key: n.key, name: n.name, meta: n.desc, mono: true });
        break;
      case "persona":
        add(personas, {
          key: n.key,
          name: n.name,
          meta: [n.version, n.model].filter(Boolean).join(" · ") || undefined,
          mono: false,
        });
        break;
      case "doc_tag":
        add(docTags, { key: n.key, name: n.name, meta: n.meta, mono: true });
        break;
      case "tool_tag":
        add(toolTags, { key: n.key, name: n.name, meta: n.meta, mono: true });
        break;
      case "tool":
        add(tools, { key: n.key, name: n.name, meta: n.meta, mono: true });
        break;
    }
    n.children.forEach(walk);
  };
  walk(root);

  return {
    roles: [...roles.values()],
    personas: [...personas.values()],
    docTags: [...docTags.values()],
    toolTags: [...toolTags.values()],
    tools: [...tools.values()],
  };
}

/** All expandable node keys (nodes with children), for "Expand all". */
export function collectExpandableKeys(root: AccessNode): string[] {
  const keys: string[] = [];
  const walk = (n: AccessNode) => {
    if (n.children.length) {
      keys.push(n.key);
      n.children.forEach(walk);
    }
  };
  walk(root);
  return keys;
}

/**
 * Keys to open by default: the root, its first role, and that role's first
 * persona — mirrors the reference design's "first chain expanded" look without
 * unfolding the whole graph.
 */
export function defaultExpandedKeys(root: AccessNode): string[] {
  const keys = new Set<string>([root.key]);
  const firstRole = root.children.find((c) => c.type === "role");
  if (firstRole) {
    keys.add(firstRole.key);
    const firstPersona = firstRole.children.find((c) => c.type === "persona");
    if (firstPersona) keys.add(firstPersona.key);
  }
  return Array.from(keys);
}
