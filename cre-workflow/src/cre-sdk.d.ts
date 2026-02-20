declare module "@chainlink/cre-sdk" {
  export const handler: (trigger: unknown, callback: (...args: any[]) => any) => unknown;
  export const httpTrigger: { trigger: (config: { path: string; method: string }) => unknown };
}
