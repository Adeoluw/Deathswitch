import { SiweMessage } from "siwe";

export async function parseSiweMessage(
  message: string,
  signature: string
): Promise<{ address: string; nonce: string }> {
  const siweMsg = new SiweMessage(message);
  const result = await siweMsg.verify({ signature });
  if (!result.success) {
    throw new Error("Invalid SIWE signature");
  }
  return {
    address: siweMsg.address.toLowerCase(),
    nonce: siweMsg.nonce,
  };
}
