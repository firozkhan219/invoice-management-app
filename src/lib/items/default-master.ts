export type DefaultableMaster = {
  id: string;
  organisationId: string;
  isDefault: boolean;
};

export function applySingleDefault<TMaster extends DefaultableMaster>(
  records: TMaster[],
  selected: TMaster
): TMaster[] {
  return records.map((record) => {
    if (record.organisationId !== selected.organisationId || record.id === selected.id) {
      return record;
    }

    return selected.isDefault ? { ...record, isDefault: false } : record;
  });
}
