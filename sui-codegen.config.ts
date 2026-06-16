import type { SuiCodegenConfig } from "@mysten/codegen";

const config: SuiCodegenConfig = {
  output: "./src/contracts",
  packages: [
    {
      package: "@local-pkg/recallforge",
      path: "./move/recallforge",
    },
  ],
};

export default config;
