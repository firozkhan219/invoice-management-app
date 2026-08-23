export type AddressDefaultState = {
  id: string;
  buyerId: string;
  isBillingDefault: boolean;
  isShippingDefault: boolean;
};

export function applyDefaultAddressSelection<TAddress extends AddressDefaultState>(
  addresses: TAddress[],
  selected: TAddress
): TAddress[] {
  return addresses.map((address) => {
    if (address.buyerId !== selected.buyerId) {
      return address;
    }

    return {
      ...address,
      isBillingDefault:
        selected.isBillingDefault && address.id !== selected.id ? false : address.isBillingDefault,
      isShippingDefault:
        selected.isShippingDefault && address.id !== selected.id ? false : address.isShippingDefault
    };
  });
}
