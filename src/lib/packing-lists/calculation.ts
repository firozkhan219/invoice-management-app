import { Prisma } from "@prisma/client";

type Num = number | Prisma.Decimal | null | undefined;

export type PackingCalculationLine = {
  quantity: number | Prisma.Decimal;
  netWeightKg: number | Prisma.Decimal;
  grossWeightKg: number | Prisma.Decimal;
  lengthCm?: Num;
  widthCm?: Num;
  heightCm?: Num;
  packageNo?: string | null;
  cartonFrom?: number | null;
  cartonTo?: number | null;
};

type PackingTotals = {
  packageCount: number;
  quantity: Prisma.Decimal;
  netWeightKg: Prisma.Decimal;
  grossWeightKg: Prisma.Decimal;
  volumeCbm: Prisma.Decimal;
};

const decimal = (value: Num) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);

/** Cartons covered by one line: "2 to 8" is 7 cartons. Lines without a carton range count as one. */
export function lineCartonCount(line: { cartonFrom?: number | null; cartonTo?: number | null }): number {
  if (!line.cartonFrom) return 1;
  const to = line.cartonTo && line.cartonTo >= line.cartonFrom ? line.cartonTo : line.cartonFrom;
  return to - line.cartonFrom + 1;
}

/** "01", "2 to 8" — the carton number label printed in the CTN NO. column. */
export function cartonRangeLabel(line: { cartonFrom?: number | null; cartonTo?: number | null; packageNo?: string | null }): string {
  if (!line.cartonFrom) return line.packageNo || "";
  const count = lineCartonCount(line);
  if (count === 1) return String(line.cartonFrom).padStart(2, "0");
  return `${line.cartonFrom} to ${line.cartonFrom + count - 1}`;
}

/** Volume of every carton on the line, in CBM, from per-carton dimensions in centimetres. */
export function lineVolumeCbm(line: PackingCalculationLine): Prisma.Decimal {
  const length = decimal(line.lengthCm);
  const width = decimal(line.widthCm);
  const height = decimal(line.heightCm);

  if (length.lte(0) || width.lte(0) || height.lte(0)) {
    return new Prisma.Decimal(0);
  }

  return length.mul(width).mul(height).div(1_000_000).mul(lineCartonCount(line));
}

export type CartonLineInput = {
  cartonFrom?: number | null;
  cartonTo?: number | null;
  piecesPerCarton?: number | null;
  netWeightPerPieceKg?: number | null;
  grossWeightPerCartonKg?: number | null;
  quantity?: number | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
};

/**
 * Works out a line's totals the way a carton-wise packing list reads:
 * quantity = pcs per carton x cartons, net = net per piece x quantity, gross = gross per carton x cartons.
 * Any total the user typed directly is kept when the per-carton or per-piece value is not given.
 */
export function resolveCartonLine(input: CartonLineInput) {
  const cartons = lineCartonCount(input);
  const quantity = input.piecesPerCarton
    ? new Prisma.Decimal(input.piecesPerCarton).mul(cartons)
    : new Prisma.Decimal(input.quantity || 0);
  const netWeightKg = input.netWeightPerPieceKg
    ? new Prisma.Decimal(input.netWeightPerPieceKg).mul(quantity)
    : new Prisma.Decimal(input.netWeightKg || 0);
  const grossWeightKg = input.grossWeightPerCartonKg
    ? new Prisma.Decimal(input.grossWeightPerCartonKg).mul(cartons)
    : new Prisma.Decimal(input.grossWeightKg || 0);

  return { cartons, quantity, netWeightKg, grossWeightKg };
}

export function calculatePackingTotals(lines: PackingCalculationLine[]) {
  const packages = new Set<string>();
  let cartons = 0;
  const usesCartonRanges = lines.some((line) => Boolean(line.cartonFrom));

  const totals = lines.reduce<PackingTotals>(
    (totals, line) => {
      if (line.packageNo) packages.add(line.packageNo);
      cartons += lineCartonCount(line);

      return {
        packageCount: 0,
        quantity: totals.quantity.add(decimal(line.quantity)),
        netWeightKg: totals.netWeightKg.add(decimal(line.netWeightKg)),
        grossWeightKg: totals.grossWeightKg.add(decimal(line.grossWeightKg)),
        volumeCbm: totals.volumeCbm.add(lineVolumeCbm(line))
      };
    },
    {
      packageCount: 0,
      quantity: new Prisma.Decimal(0),
      netWeightKg: new Prisma.Decimal(0),
      grossWeightKg: new Prisma.Decimal(0),
      volumeCbm: new Prisma.Decimal(0)
    }
  );

  return {
    ...totals,
    // Carton ranges give an exact carton count; older lines fall back to distinct package numbers.
    packageCount: usesCartonRanges ? cartons : packages.size || lines.length
  };
}
