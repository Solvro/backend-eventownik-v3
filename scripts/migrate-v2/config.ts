import { parseArgs } from "node:util";

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  buckets: { events: string; forms: string };
}

export interface Config {
  v2DatabaseUrl: string;
  v3DatabaseUrl: string;
  apply: boolean;
  prune: boolean;
  storageDirectory: string | undefined;
  s3: S3Config | undefined;
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export function loadConfig(argv: string[]): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      apply: { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      "v2-storage-dir": { type: "string" },
    },
  });

  if (values.prune && !values.apply) {
    throw new Error("--prune only works together with --apply");
  }

  const v2DatabaseUrl = requireEnvironment("V2_DATABASE_URL");
  const v3DatabaseUrl = requireEnvironment("DATABASE_URL");
  if (v2DatabaseUrl === v3DatabaseUrl) {
    throw new Error("V2_DATABASE_URL and DATABASE_URL must differ");
  }

  const storageDirectory = values["v2-storage-dir"];
  return {
    v2DatabaseUrl,
    v3DatabaseUrl,
    apply: values.apply,
    prune: values.prune,
    storageDirectory,
    s3:
      storageDirectory === undefined
        ? undefined
        : {
            endpoint: requireEnvironment("S3_ENDPOINT"),
            accessKey: requireEnvironment("S3_ACCESS_KEY"),
            secretKey: requireEnvironment("S3_SECRET_KEY"),
            buckets: {
              events: requireEnvironment("S3_BUCKET_EVENTS"),
              forms: requireEnvironment("S3_BUCKET_FORMS"),
            },
          },
  };
}
