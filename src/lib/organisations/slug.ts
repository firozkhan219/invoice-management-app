export async function slugifyOrganisationName(
  name: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "organisation";

  let slug = base;
  let suffix = 2;

  while (await exists(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
