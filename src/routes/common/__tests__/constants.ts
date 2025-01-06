interface TestSafe {
  chainId: string;
  address: `0x${string}`;
  owners: Array<`0x${string}`>;
}

export const TEST_SAFE: TestSafe = {
  chainId: '1',
  address: '0x8675B754342754A30A2AeF474D114d8460bca19b' as const,
  owners: ['0x6c15f69EE76DA763e5b5DB6f7f0C29eb625bc9B7' as const],
};
