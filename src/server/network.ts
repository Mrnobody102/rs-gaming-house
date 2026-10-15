type Interfaces = Record<
  string,
  { address: string; family: string; internal: boolean }[] | undefined
>;
export function lanAddress(interfaces: Interfaces) {
  return Object.entries(interfaces)
    .flatMap(([name, items]) =>
      (items || [])
        .filter(
          (item) =>
            item.family === "IPv4" &&
            !item.internal &&
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address),
        )
        .map((item) => ({
          address: item.address,
          priority: /vmware|vethernet|virtual|wsl|vpn|loopback|pseudo/i.test(
            name,
          )
            ? -100
            : /wi[ -]?fi|wlan/i.test(name)
              ? 30
              : /ethernet|^eth\d|^en\d/i.test(name)
                ? 20
                : 0,
        })),
    )
    .sort((a, b) => b.priority - a.priority)[0]?.address;
}
